const Mark = require('../models/Mark');
const Student = require('../models/Student');
const Assessment = require('../models/Assessment');
const GradeScale = require('../models/GradeScale');
const gradingEngine = require('../utils/gradingEngine');
const AuditLog = require('../models/AuditLog');
const Teacher = require('../models/Teacher');

exports.getMarks = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      assessment,
      class: classId,
      subject,
      student: studentId,
      term,
      academicYear,
      isApproved,
      sort = '-createdAt',
    } = req.query;

    const query = {};
    if (assessment) query.assessment = assessment;
    if (classId) query.class = classId;
    if (subject) query.subject = subject;
    if (studentId) query.student = studentId;
    if (term) query.term = term;
    if (academicYear) query.academicYear = academicYear;
    if (isApproved !== undefined) query.isApproved = isApproved === 'true';

    if (req.teacherClassIds && req.teacherClassIds.length > 0) {
      if (classId) {
        if (!req.teacherClassIds.includes(classId)) {
          return res.status(403).json({ success: false, message: 'You are not assigned to this class' });
        }
      } else {
        query.class = { $in: req.teacherClassIds };
      }
    }

    if (req.teacherStreamIds && req.teacherStreamIds.length > 0 && req.teacherScope) {
      const hasUnrestricted = Object.values(req.teacherScope.classMap).some(c => c.allStreams);
      if (!hasUnrestricted) {
        query.stream = { $in: req.teacherStreamIds };
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [marks, total] = await Promise.all([
      Mark.find(query)
        .populate('student', 'firstName lastName admissionNumber')
        .populate('assessment', 'name type maxScore')
        .populate('subject', 'name code')
        .populate('class', 'name')
        .populate('gradedBy', 'firstName lastName')
        .populate('approvedBy', 'firstName lastName')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      Mark.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: marks,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.enterMarks = async (req, res) => {
  try {
    const { student: studentId, assessment: assessmentId, subject, class: classId, stream, score, totalScore, remarks, academicYear, term } = req.body;

    if (!studentId || !assessmentId || !subject || !classId || score === undefined) {
      return res.status(400).json({ success: false, message: 'student, assessment, subject, class and score are required' });
    }

    const assessment = await Assessment.findById(assessmentId);
    if (!assessment) {
      return res.status(404).json({ success: false, message: 'Assessment not found' });
    }

    if (assessment.status === 'closed') {
      return res.status(400).json({ success: false, message: 'Assessment is closed for submissions' });
    }

    const effectiveMaxScore = totalScore || assessment.maxScore;
    if (score > assessment.maxScore) {
      return res.status(400).json({ success: false, message: `Score cannot exceed max score of ${assessment.maxScore}` });
    }
    if (score < 0) {
      return res.status(400).json({ success: false, message: 'Score cannot be negative' });
    }

    const gradeScales = await GradeScale.find({ isActive: true, system: 'percentage' }).sort({ minScore: -1 });

    const maxForTotal = totalScore || assessment.maxScore;
    const percentageScore = (score / maxForTotal) * 100;
    const gradeResult = gradingEngine.calculateGrade(percentageScore, gradeScales);

    const existing = await Mark.findOne({ student: studentId, assessment: assessmentId });

    let mark;
    if (existing) {
      existing.score = score;
      existing.totalScore = maxForTotal;
      existing.grade = gradeResult.grade;
      existing.gradePoint = gradeResult.gradePoint;
      existing.remarks = remarks || gradeResult.remarks;
      existing.subject = subject;
      existing.stream = stream;
      existing.class = classId;
      existing.gradedBy = req.user._id;
      existing.isApproved = false;
      await existing.save();
      mark = existing;
    } else {
      mark = await Mark.create({
        student: studentId,
        assessment: assessmentId,
        subject,
        class: classId,
        stream,
        academicYear: academicYear || assessment.academicYear,
        term: term || assessment.term,
        score,
        totalScore: maxForTotal,
        grade: gradeResult.grade,
        gradePoint: gradeResult.gradePoint,
        remarks: remarks || gradeResult.remarks,
        gradedBy: req.user._id,
      });
    }

    const populated = await Mark.findById(mark._id)
      .populate('student', 'firstName lastName admissionNumber')
      .populate('assessment', 'name type maxScore')
      .populate('subject', 'name code');

    res.json({
      success: true,
      data: populated,
      message: 'Marks entered successfully',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.bulkEnterMarks = async (req, res) => {
  try {
    const { marks, assessment: assessmentId, subject, class: classId } = req.body;

    if (!marks || !Array.isArray(marks) || marks.length === 0) {
      return res.status(400).json({ success: false, message: 'marks array is required' });
    }

    if (!assessmentId || !subject || !classId) {
      return res.status(400).json({ success: false, message: 'assessment, subject and class are required' });
    }

    const assessment = await Assessment.findById(assessmentId);
    if (!assessment) {
      return res.status(404).json({ success: false, message: 'Assessment not found' });
    }

    if (assessment.status === 'closed') {
      return res.status(400).json({ success: false, message: 'Assessment is closed for submissions' });
    }

    const gradeScales = await GradeScale.find({ isActive: true, system: 'percentage' }).sort({ minScore: -1 });

    const results = { created: 0, updated: 0, errors: [] };

    for (const entry of marks) {
      try {
        const { student: studentId, score, totalScore, remarks, stream } = entry;

        if (!studentId || score === undefined) {
          results.errors.push({ student: studentId, reason: 'Missing student or score' });
          continue;
        }

        const maxForTotal = totalScore || assessment.maxScore;
        if (score > maxForTotal) {
          results.errors.push({ student: studentId, reason: `Score cannot exceed max score of ${maxForTotal}` });
          continue;
        }
        if (score < 0) {
          results.errors.push({ student: studentId, reason: 'Score cannot be negative' });
          continue;
        }

        const percentage = (score / maxForTotal) * 100;
        const gradeResult = gradingEngine.calculateGrade(percentage, gradeScales);

        const existing = await Mark.findOne({ student: studentId, assessment: assessmentId });

        if (existing) {
          Object.assign(existing, {
            score, subject, class: classId, stream,
            totalScore: maxForTotal,
            grade: gradeResult.grade,
            gradePoint: gradeResult.gradePoint,
            remarks: remarks || gradeResult.remarks,
            gradedBy: req.user._id,
            isApproved: false,
          });
          await existing.save();
          results.updated++;
        } else {
          await Mark.create({
            student: studentId,
            assessment: assessmentId,
            subject,
            class: classId,
            stream,
            academicYear: assessment.academicYear,
            term: assessment.term,
            score,
            totalScore: maxForTotal,
            grade: gradeResult.grade,
            gradePoint: gradeResult.gradePoint,
            remarks: remarks || gradeResult.remarks,
            gradedBy: req.user._id,
          });
          results.created++;
        }
      } catch (err) {
        results.errors.push({ student: entry.student, reason: err.message });
      }
    }

    await AuditLog.create({
      user: req.user._id,
      action: 'BULK_ENTER_MARKS',
      resource: 'Mark',
      details: { assessment: assessmentId, subject, class: classId, created: results.created, updated: results.updated },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({
      success: true,
      data: results,
      message: `Marks entered: ${results.created} created, ${results.updated} updated`,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.approveMarks = async (req, res) => {
  try {
    const { markIds } = req.body;

    if (!markIds || !Array.isArray(markIds) || markIds.length === 0) {
      return res.status(400).json({ success: false, message: 'markIds array is required' });
    }

    const result = await Mark.updateMany(
      { _id: { $in: markIds } },
      {
        $set: {
          isApproved: true,
          approvedBy: req.user._id,
          approvedAt: new Date(),
        },
      }
    );

    const gradedByUsers = await Mark.distinct('gradedBy', { _id: { $in: markIds } });

    const { sendNotificationToMany } = require('../utils/notificationService');
    await sendNotificationToMany({
      recipients: gradedByUsers,
      type: 'result',
      title: 'Marks approved',
      message: `${result.modifiedCount} marks you entered have been approved`,
      link: '/marks',
      sentBy: req.user._id,
    });

    await AuditLog.create({
      user: req.user._id,
      action: 'APPROVE_MARKS',
      resource: 'Mark',
      details: { count: markIds.length },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({
      success: true,
      data: { modifiedCount: result.modifiedCount },
      message: `${result.modifiedCount} marks approved`,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getMissingMarks = async (req, res) => {
  try {
    const assessmentId = req.params.assessmentId || req.query.assessment;
    const classId = req.query.class;

    if (!assessmentId || !classId) {
      return res.status(400).json({ success: false, message: 'assessment and class are required' });
    }

    const assessment = await Assessment.findById(assessmentId);
    if (!assessment) {
      return res.status(404).json({ success: false, message: 'Assessment not found' });
    }

    const streamFilter = {};
    if (req.teacherStreamIds && req.teacherStreamIds.length > 0 && req.teacherScope) {
      const classEntry = req.teacherScope.classMap[classId];
      if (classEntry && !classEntry.allStreams && classEntry.streamIds.length > 0) {
        streamFilter.stream = { $in: classEntry.streamIds };
      }
    }

    const studentQuery = { class: classId, status: 'active' };
    if (streamFilter.stream) studentQuery.stream = streamFilter.stream;
    const students = await Student.find(studentQuery);

    const markQuery = { assessment: assessmentId, class: classId };
    if (streamFilter.stream) markQuery.stream = streamFilter.stream;
    const marks = await Mark.find(markQuery);

    const missing = gradingEngine.detectMissingMarks(students, [assessment], marks);

    res.json({
      success: true,
      data: missing,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getSubjectMarks = async (req, res) => {
  try {
    const { subject: subjectId, class: classId, term, academicYear } = req.query;

    if (!subjectId || !classId) {
      return res.status(400).json({ success: false, message: 'subject and class are required' });
    }

    const query = { subject: subjectId, class: classId };
    if (term) query.term = term;
    if (academicYear) query.academicYear = academicYear;

    if (req.teacherStreamIds && req.teacherStreamIds.length > 0 && req.teacherScope) {
      const classEntry = req.teacherScope.classMap[classId];
      if (classEntry && !classEntry.allStreams && classEntry.streamIds.length > 0) {
        query.stream = { $in: classEntry.streamIds };
      }
    }

    const marks = await Mark.find(query)
      .populate('student', 'firstName lastName admissionNumber')
      .populate('assessment', 'name type maxScore weight')
      .sort({ student: 1, assessment: 1 });

    const grouped = marks.reduce((acc, mark) => {
      const key = `${mark.student?._id}`;
      if (!acc[key]) {
        acc[key] = {
          student: mark.student,
          marks: [],
          totalScore: 0,
          count: 0,
        };
      }
      acc[key].marks.push(mark);
      acc[key].totalScore += mark.score || 0;
      acc[key].count++;
      return acc;
    }, {});

    const students = Object.values(grouped).map((s) => ({
      ...s,
      average: s.count > 0 ? parseFloat((s.totalScore / s.count).toFixed(2)) : 0,
    }));

    const ranked = gradingEngine.calculatePosition(students, { _id: subjectId });

    res.json({
      success: true,
      data: { marks, summary: ranked },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getStudentMarks = async (req, res) => {
  try {
    const { academicYear, term } = req.query;

    const query = { student: req.params.id };
    if (academicYear) query.academicYear = academicYear;
    if (term) query.term = term;

    const marks = await Mark.find(query)
      .populate('assessment', 'name type maxScore weight')
      .populate('subject', 'name code')
      .populate('class', 'name')
      .sort({ createdAt: -1 });

    const grouped = marks.reduce((acc, mark) => {
      const subjectId = mark.subject?._id?.toString() || mark.subject?.toString();
      if (!acc[subjectId]) {
        acc[subjectId] = {
          subject: mark.subject,
          marks: [],
          total: 0,
        };
      }
      acc[subjectId].marks.push(mark);
      acc[subjectId].total += mark.score || 0;
      return acc;
    }, {});

    const summary = Object.values(grouped).map((g) => ({
      subject: g.subject,
      marks: g.marks,
      average: g.marks.length > 0 ? parseFloat((g.total / g.marks.length).toFixed(2)) : 0,
      assessments: g.marks.length,
    }));

    const gradeScales = await GradeScale.find({ isActive: true, system: 'percentage' }).sort({ minScore: -1 });
    const overallAverage = summary.length > 0
      ? parseFloat((summary.reduce((a, s) => a + s.average, 0) / summary.length).toFixed(2))
      : 0;
    const overallGrade = gradingEngine.calculateGrade(overallAverage, gradeScales);

    res.json({
      success: true,
      data: {
        summary,
        overallAverage,
        overallGrade,
        marks,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getStudentsForEntry = async (req, res) => {
  try {
    const { class: classId, subject, assessment, stream } = req.query;
    if (!classId || !subject || !assessment) {
      return res.status(400).json({ success: false, message: 'class, subject, and assessment are required' });
    }

    const studentQuery = { class: classId };
    if (stream) {
      studentQuery.stream = stream;
    } else if (req.teacherStreamIds && req.teacherStreamIds.length > 0 && req.teacherScope) {
      const classEntry = req.teacherScope.classMap[classId];
      if (classEntry && !classEntry.allStreams && classEntry.streamIds.length > 0) {
        studentQuery.stream = { $in: classEntry.streamIds };
      }
    }

    const students = await Student.find(studentQuery)
      .populate('user', 'firstName lastName')
      .sort({ firstName: 1 });

    const existingMarks = await Mark.find({
      assessment,
      subject,
      class: classId,
      student: { $in: students.map((s) => s._id) },
    });

    const markMap = {};
    existingMarks.forEach((m) => {
      markMap[m.student.toString()] = {
        score: m.score,
        remarks: m.remarks,
        _id: m._id,
        isApproved: m.isApproved,
      };
    });

    const result = students.map((s) => ({
      _id: s._id,
      firstName: s.firstName,
      lastName: s.lastName,
      fullName: `${s.firstName} ${s.lastName}`,
      admissionNumber: s.admissionNumber,
      mark: markMap[s._id.toString()] || null,
    }));

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateMark = async (req, res) => {
  try {
    const { score, totalScore, remarks } = req.body;

    const mark = await Mark.findById(req.params.id);
    if (!mark) {
      return res.status(404).json({ success: false, message: 'Mark not found' });
    }

    if (req.user.role !== 'headteacher' && req.user.role !== 'academic_teacher') {
      const TeacherAssignment = require('../models/TeacherAssignment');
      const Class = require('../models/Class');
      const teacher = await Teacher.findOne({ user: req.user._id });
      if (!teacher) {
        return res.status(404).json({ success: false, message: 'Teacher profile not found' });
      }
      const assignment = await TeacherAssignment.findOne({
        teacher: teacher._id,
        subject: mark.subject,
        class: mark.class,
      });
      const isClassTeacher = mark.class
        ? await Class.findOne({ _id: mark.class, classTeacher: teacher._id })
        : null;
      if (!assignment && !isClassTeacher) {
        return res.status(403).json({ success: false, message: 'You are not assigned to this mark\'s subject and class' });
      }
    }

    if (mark.isApproved) {
      return res.status(400).json({ success: false, message: 'Cannot update approved marks. Unapprove first.' });
    }

    const assessment = await Assessment.findById(mark.assessment);
    if (assessment && assessment.status === 'closed') {
      return res.status(400).json({ success: false, message: 'Assessment is closed' });
    }

    if (score !== undefined) {
      mark.score = score;
    }
    if (totalScore !== undefined) {
      mark.totalScore = totalScore;
    }
    if (remarks !== undefined) {
      mark.remarks = remarks;
    }

    const maxForTotal = mark.totalScore || assessment?.maxTotal || 100;
    const percentage = (mark.score / maxForTotal) * 100;
    const gradeScales = await GradeScale.find({ isActive: true, system: 'percentage' }).sort({ minScore: -1 });
    const gradeResult = gradingEngine.calculateGrade(percentage, gradeScales);
    mark.grade = gradeResult.grade;
    mark.gradePoint = gradeResult.gradePoint;
    mark.gradedBy = req.user._id;

    await mark.save();

    const populated = await Mark.findById(mark._id)
      .populate('student', 'firstName lastName admissionNumber')
      .populate('assessment', 'name type maxScore')
      .populate('subject', 'name code');

    res.json({
      success: true,
      data: populated,
      message: 'Mark updated successfully',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getSubjectPerformanceComparison = async (req, res) => {
  try {
    const TeacherAssignment = require('../models/TeacherAssignment');
    const AcademicYear = require('../models/AcademicYear');
    const Term = require('../models/Term');
    const Teacher = require('../models/Teacher');

    const teacher = await Teacher.findOne({ user: req.user._id });
    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Teacher profile not found' });
    }

    const subjectId = req.params.subjectId;

    const assignments = await TeacherAssignment.find({
      teacher: teacher._id,
      ...(subjectId ? { subject: subjectId } : {}),
    }).populate('subject', 'name code');

    const currentYear = await AcademicYear.findOne({ isCurrent: true });
    const currentTerm = currentYear
      ? await Term.findOne({ academicYear: currentYear._id, isCurrent: true })
      : null;

    const previousTerm = currentYear
      ? await Term.findOne({ academicYear: currentYear._id, isCurrent: false }).sort({ createdAt: -1 })
      : null;

    const results = [];

    for (const assignment of assignments) {
      const subject = assignment.subject;
      if (!subject) continue;

      const markFilter = { subject: subject._id };
      if (assignment.class) markFilter.class = assignment.class;
      if (assignment.stream) markFilter.stream = assignment.stream;

      const currentMarks = currentTerm
        ? await Mark.find({ ...markFilter, term: currentTerm._id })
        : [];
      const currentAvg = currentMarks.length > 0
        ? currentMarks.reduce((sum, m) => sum + m.score, 0) / currentMarks.length
        : 0;

      let previousAvg = 0;
      if (previousTerm) {
        const previousMarks = await Mark.find({ ...markFilter, term: previousTerm._id });
        previousAvg = previousMarks.length > 0
          ? previousMarks.reduce((sum, m) => sum + m.score, 0) / previousMarks.length
          : 0;
      }

      results.push({
        subjectId: subject._id,
        subjectName: subject.name,
        subjectCode: subject.code,
        currentAverage: parseFloat(currentAvg.toFixed(2)),
        previousAverage: parseFloat(previousAvg.toFixed(2)),
        change: previousAvg > 0
          ? parseFloat((((currentAvg - previousAvg) / previousAvg) * 100).toFixed(2))
          : 0,
        totalStudents: currentMarks.length,
      });
    }

    res.json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};