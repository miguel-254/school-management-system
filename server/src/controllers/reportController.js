const Attendance = require('../models/Attendance');
const Student = require('../models/Student');
const Mark = require('../models/Mark');
const Assessment = require('../models/Assessment');
const GradeScale = require('../models/GradeScale');
const Class = require('../models/Class');
const Subject = require('../models/Subject');
const gradingEngine = require('../utils/gradingEngine');
const { exportToExcel, generateAttendanceReport, generateMarksReport } = require('../utils/excelExporter');
const { generateReportCard } = require('../utils/pdfGenerator');
const SchoolSetting = require('../models/SchoolSetting');

exports.getAttendanceReport = async (req, res) => {
  try {
    const { class: classId, stream, startDate, endDate, academicYear, term, format } = req.query;

    const match = {};
    if (classId) {
      match.class = new (require('mongoose').Types.ObjectId)(classId);
    } else if (req.user.role === 'teacher') {
      const Teacher = require('../models/Teacher');
      const TeacherAssignment = require('../models/TeacherAssignment');
      const teacher = await Teacher.findOne({ user: req.user._id });
      if (teacher) {
        const assignments = await TeacherAssignment.find({ teacher: teacher._id }).distinct('class');
        match.class = { $in: assignments };
      }
    }
    if (academicYear) match.academicYear = new (require('mongoose').Types.ObjectId)(academicYear);
    if (term) match.term = new (require('mongoose').Types.ObjectId)(term);
    if (startDate || endDate) {
      match.date = {};
      if (startDate) match.date.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        match.date.$lte = end;
      }
    }

    if (req.teacherStreamIds && req.teacherStreamIds.length > 0 && req.teacherScope) {
      if (!Object.values(req.teacherScope.classMap).some(c => c.allStreams)) {
        const streamStudentIds = await Student.find({
          class: match.class || { $in: Object.keys(req.teacherScope.classMap) },
          stream: { $in: req.teacherStreamIds },
        }).distinct('_id');
        match.student = { $in: streamStudentIds };
      }
    }

    const report = await Attendance.aggregate([
      { $match: match },
      { $group: {
          _id: '$student',
          totalDays: { $sum: 1 },
          present: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
          absent: { $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] } },
          excused: { $sum: { $cond: [{ $in: ['$status', ['excused', 'sick']] }, 1, 0] } },
          sick: { $sum: { $cond: [{ $eq: ['$status', 'sick'] }, 1, 0] } },
        },
      },
      { $lookup: { from: 'students', localField: '_id', foreignField: '_id', as: 'student' } },
      { $unwind: '$student' },
      { $lookup: { from: 'classes', localField: 'student.class', foreignField: '_id', as: 'class' } },
      { $unwind: { path: '$class', preserveNullAndEmptyArrays: true } },
      { $lookup: { from: 'streams', localField: 'student.stream', foreignField: '_id', as: 'stream' } },
      { $unwind: { path: '$stream', preserveNullAndEmptyArrays: true } },
      { $project: {
          _id: 0,
          student: { _id: 1, firstName: 1, lastName: 1, admissionNumber: 1 },
          className: '$class.name',
          streamName: '$stream.name',
          totalDays: 1, present: 1, absent: 1, excused: 1, sick: 1,
          percentage: {
            $cond: {
              if: { $gt: ['$totalDays', 0] },
              then: { $round: [{ $multiply: [{ $divide: ['$present', '$totalDays'] }, 100] }, 2] },
              else: 0,
            },
          },
        },
      },
      { $sort: { percentage: -1 } },
    ]);

    if (format === 'excel') {
      const { headers, rows } = generateAttendanceReport(report);
      const buffer = exportToExcel(rows, headers, 'AttendanceReport');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=attendance_report.xlsx');
      return res.send(buffer);
    }

    const summary = {
      totalStudents: report.length,
      averagePercentage: report.length > 0
        ? parseFloat((report.reduce((s, r) => s + r.percentage, 0) / report.length).toFixed(2)) : 0,
      totalPresent: report.reduce((s, r) => s + r.present, 0),
      totalAbsent: report.reduce((s, r) => s + r.absent, 0),
    };

    res.json({ success: true, data: { report, summary } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getPerformanceReport = async (req, res) => {
  try {
    const { class: classId, subject: subjectId, term, academicYear, format } = req.query;

    if (!classId) {
      return res.status(400).json({ success: false, message: 'class is required' });
    }

    let streamFilter = {};
    if (req.teacherStreamIds && req.teacherStreamIds.length > 0 && req.teacherScope) {
      const classEntry = req.teacherScope.classMap[classId];
      if (classEntry && !classEntry.allStreams && classEntry.streamIds.length > 0) {
        streamFilter.stream = { $in: classEntry.streamIds };
      }
    }

    const studentQuery = { class: classId, status: 'active' };
    if (streamFilter.stream) studentQuery.stream = streamFilter.stream;
    const students = await Student.find(studentQuery).sort({ lastName: 1 });

    const query = { class: classId };
    if (subjectId) query.subject = subjectId;
    if (term) query.term = term;
    if (academicYear) query.academicYear = academicYear;
    if (streamFilter.stream) query.stream = streamFilter.stream;

    const marks = await Mark.find(query).populate('subject', 'name code').populate('assessment', 'name type');
    const gradeScales = await GradeScale.find({ isActive: true, system: 'percentage' });

    const studentData = students.map((student) => {
      const studentMarks = marks.filter((m) => m.student.toString() === student._id.toString());
      const totalScore = studentMarks.reduce((s, m) => s + (m.score || 0), 0);
      const count = studentMarks.length;
      const average = count > 0 ? parseFloat((totalScore / count).toFixed(2)) : 0;
      const gradeResult = gradingEngine.calculateGrade(average, gradeScales);
      return {
        _id: student._id,
        admissionNumber: student.admissionNumber,
        firstName: student.firstName,
        lastName: student.lastName,
        marks: studentMarks,
        totalScore, average,
        grade: gradeResult.grade,
        gradePoint: gradeResult.gradePoint,
      };
    });

    const ranking = gradingEngine.calculateOverallPosition(studentData);

    const stats = {
      totalStudents: studentData.length,
      classAverage: studentData.length > 0
        ? parseFloat((studentData.reduce((s, d) => s + d.average, 0) / studentData.length).toFixed(2)) : 0,
      highest: studentData.length > 0 ? Math.max(...studentData.map((d) => d.average)) : 0,
      lowest: studentData.length > 0 ? Math.min(...studentData.map((d) => d.average)) : 0,
    };

    if (format === 'excel') {
      const subjects = subjectId ? [await Subject.findById(subjectId)] : [];
      const { headers, rows } = generateMarksReport(
        ranking.map((r) => ({ ...r.student, ...r })),
        subjects
      );
      const buffer = exportToExcel(rows, headers, 'PerformanceReport');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=performance_report.xlsx');
      return res.send(buffer);
    }

    res.json({ success: true, data: { ranking, stats, gradeScales } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getGradeAnalysisReport = async (req, res) => {
  try {
    const { class: classId, subject: subjectId, term, academicYear, format } = req.query;

    const match = {};
    if (classId) match.class = new (require('mongoose').Types.ObjectId)(classId);
    if (subjectId) match.subject = new (require('mongoose').Types.ObjectId)(subjectId);
    if (term) match.term = new (require('mongoose').Types.ObjectId)(term);
    if (academicYear) match.academicYear = new (require('mongoose').Types.ObjectId)(academicYear);

    if (req.teacherStreamIds && req.teacherStreamIds.length > 0 && req.teacherScope) {
      if (!Object.values(req.teacherScope.classMap).some(c => c.allStreams)) {
        match.stream = { $in: req.teacherStreamIds.map(id => new (require('mongoose').Types.ObjectId)(id)) };
      }
    }

    const gradeScales = await GradeScale.find({ isActive: true, system: 'percentage' });

    const distribution = await Mark.aggregate([
      { $match: match },
      { $group: { _id: '$grade', count: { $sum: 1 }, averageScore: { $avg: '$score' }, maxScore: { $max: '$score' }, minScore: { $min: '$score' } } },
      { $sort: { _id: 1 } },
    ]);

    const stats = await Mark.aggregate([
      { $match: match },
      { $group: { _id: null, totalMarks: { $sum: 1 }, overallAverage: { $avg: '$score' }, highestScore: { $max: '$score' }, lowestScore: { $min: '$score' }, stdDev: { $stdDevPop: '$score' } } },
    ]);

    if (format === 'excel') {
      const headers = ['Grade', 'Count', 'Average Score', 'Highest Score', 'Lowest Score'];
      const rows = distribution.map((d) => [d._id, d.count, d.averageScore.toFixed(2), d.maxScore, d.minScore]);
      const buffer = exportToExcel(rows, headers, 'GradeAnalysis');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=grade_analysis.xlsx');
      return res.send(buffer);
    }

    res.json({ success: true, data: { distribution, stats: stats[0] || {}, gradeScales } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getRankingReport = async (req, res) => {
  try {
    const { class: classId, term, academicYear, limit: limitStr, format } = req.query;
    const rankLimit = parseInt(limitStr) || 0;

    if (!classId) {
      return res.status(400).json({ success: false, message: 'class is required' });
    }

    let streamFilter = {};
    if (req.teacherStreamIds && req.teacherStreamIds.length > 0 && req.teacherScope) {
      const classEntry = req.teacherScope.classMap[classId];
      if (classEntry && !classEntry.allStreams && classEntry.streamIds.length > 0) {
        streamFilter.stream = { $in: classEntry.streamIds };
      }
    }

    const studentQuery = { class: classId, status: 'active' };
    if (streamFilter.stream) studentQuery.stream = streamFilter.stream;
    const students = await Student.find(studentQuery).sort({ lastName: 1 });

    const query = { class: classId };
    if (term) query.term = term;
    if (academicYear) query.academicYear = academicYear;
    if (streamFilter.stream) query.stream = streamFilter.stream;

    const marks = await Mark.find(query).populate('subject', 'name');
    const gradeScales = await GradeScale.find({ isActive: true, system: 'percentage' });

    const studentData = students.map((student) => {
      const studentMarks = marks.filter((m) => m.student.toString() === student._id.toString());
      const totalScore = studentMarks.reduce((s, m) => s + (m.score || 0), 0);
      const count = studentMarks.length;
      const average = count > 0 ? parseFloat((totalScore / count).toFixed(2)) : 0;
      return { ...student.toObject(), marks: studentMarks, totalScore, average };
    });

    const ranking = gradingEngine.calculateOverallPosition(studentData);
    const rankedData = studentData.map((s) => {
      const rank = ranking.find((r) => r.student._id.toString() === s._id.toString());
      return { ...s, position: rank?.position || 0 };
    });

    rankedData.sort((a, b) => (a.position || 999) - (b.position || 999));

    const result = rankLimit > 0 ? rankedData.slice(0, rankLimit) : rankedData;

    if (format === 'excel') {
      const headers = ['Position', 'Admission No.', 'Student Name', 'Average', 'Grade', 'Total Subjects'];
      const rows = result.map((s) => [
        s.position, s.admissionNumber,
        `${s.firstName} ${s.lastName}`,
        s.average,
        gradingEngine.calculateGrade(s.average, gradeScales).grade,
        s.marks.length,
      ]);
      const buffer = exportToExcel(rows, headers, 'Ranking');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=ranking_report.xlsx');
      return res.send(buffer);
    }

    res.json({ success: true, data: { ranking: result, classSize: students.length } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getSubjectPerformanceReport = async (req, res) => {
  try {
    const { class: classId, subject: subjectId, term, academicYear, format } = req.query;

    if (!classId || !subjectId) {
      return res.status(400).json({ success: false, message: 'class and subject are required' });
    }

    const subject = await Subject.findById(subjectId);
    if (!subject) {
      return res.status(404).json({ success: false, message: 'Subject not found' });
    }

    let streamFilter = {};
    if (req.teacherStreamIds && req.teacherStreamIds.length > 0 && req.teacherScope) {
      const classEntry = req.teacherScope.classMap[classId];
      if (classEntry && !classEntry.allStreams && classEntry.streamIds.length > 0) {
        streamFilter.stream = { $in: classEntry.streamIds };
      }
    }

    const studentQuery = { class: classId, status: 'active' };
    if (streamFilter.stream) studentQuery.stream = streamFilter.stream;
    const students = await Student.find(studentQuery);

    const query = { class: classId, subject: subjectId };
    if (term) query.term = term;
    if (academicYear) query.academicYear = academicYear;
    if (streamFilter.stream) query.stream = streamFilter.stream;

    const marks = await Mark.find(query).populate('assessment', 'name type maxScore');
    const gradeScales = await GradeScale.find({ isActive: true, system: 'percentage' });

    const studentPerformance = students.map((student) => {
      const studentMarks = marks.filter((m) => m.student.toString() === student._id.toString());
      const scores = studentMarks.map((m) => m.score || 0);
      const totalScore = scores.reduce((s, v) => s + v, 0);
      const average = scores.length > 0 ? parseFloat((totalScore / scores.length).toFixed(2)) : 0;
      const gradeResult = gradingEngine.calculateGrade(average, gradeScales);
      return {
        student: { _id: student._id, firstName: student.firstName, lastName: student.lastName, admissionNumber: student.admissionNumber },
        marks: studentMarks,
        totalScore, average,
        grade: gradeResult.grade,
        gradePoint: gradeResult.gradePoint,
      };
    });

    studentPerformance.sort((a, b) => b.average - a.average);

    const ranking = gradingEngine.calculatePosition(studentPerformance.map((s) => ({ ...s, marks: s.marks })), { _id: subjectId });

    const stats = {
      subject: { name: subject.name, code: subject.code },
      totalStudents: studentPerformance.length,
      classAverage: studentPerformance.length > 0
        ? parseFloat((studentPerformance.reduce((s, p) => s + p.average, 0) / studentPerformance.length).toFixed(2)) : 0,
      highest: studentPerformance.length > 0 ? Math.max(...studentPerformance.map((p) => p.average)) : 0,
      lowest: studentPerformance.length > 0 ? Math.min(...studentPerformance.map((p) => p.average)) : 0,
    };

    if (format === 'excel') {
      const { headers, rows } = generateMarksReport(ranking.map((r) => ({ ...r.student, ...r })), [subject]);
      const buffer = exportToExcel(rows, headers, 'SubjectPerformance');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=subject_performance.xlsx');
      return res.send(buffer);
    }

    res.json({ success: true, data: { subject, stats, ranking: ranking.map((r) => ({ ...r, student: r.student })) } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getClassPerformanceReport = async (req, res) => {
  try {
    const { term, academicYear, format } = req.query;

    let classesQuery = {};
    if (req.teacherClassIds) {
      classesQuery._id = { $in: req.teacherClassIds };
    }
    const classes = await Class.find(classesQuery).populate('classTeacher', 'firstName lastName');

    const reports = await Promise.all(
      classes.map(async (cls) => {
        const hasStreamRestriction = req.teacherStreamIds && req.teacherStreamIds.length > 0 && req.teacherScope
          && req.teacherScope.classMap[cls._id.toString()] && !req.teacherScope.classMap[cls._id.toString()].allStreams;
        const classStreamIds = hasStreamRestriction
          ? req.teacherScope.classMap[cls._id.toString()].streamIds
          : null;

        const studentQuery = { class: cls._id, status: 'active' };
        if (classStreamIds) studentQuery.stream = { $in: classStreamIds };
        const students = await Student.find(studentQuery);

        const query = { class: cls._id };
        if (term) query.term = term;
        if (academicYear) query.academicYear = academicYear;
        if (classStreamIds) query.stream = { $in: classStreamIds };

        const marks = await Mark.find(query);
        const allScores = marks.map((m) => m.score || 0);
        const average = allScores.length > 0
          ? parseFloat((allScores.reduce((s, v) => s + v, 0) / allScores.length).toFixed(2)) : 0;
        const highest = allScores.length > 0 ? Math.max(...allScores) : 0;
        const lowest = allScores.length > 0 ? Math.min(...allScores) : 0;

        return {
          class: { _id: cls._id, name: cls.name, code: cls.code, classTeacher: cls.classTeacher },
          totalStudents: students.length,
          totalMarks: allScores.length,
          average, highest, lowest,
        };
      })
    );

    reports.sort((a, b) => b.average - a.average);
    reports.forEach((r, i) => { r.position = i + 1; });

    if (format === 'excel') {
      const headers = ['Position', 'Class', 'Class Teacher', 'Total Students', 'Average Score', 'Highest', 'Lowest'];
      const rows = reports.map((r) => [
        r.position, r.class.name,
        r.class.classTeacher ? `${r.class.classTeacher.firstName} ${r.class.classTeacher.lastName}` : 'N/A',
        r.totalStudents, r.average, r.highest, r.lowest,
      ]);
      const buffer = exportToExcel(rows, headers, 'ClassPerformance');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=class_performance.xlsx');
      return res.send(buffer);
    }

    res.json({ success: true, data: reports });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.exportReport = async (req, res) => {
  try {
    const { type, format = 'excel', ...filters } = req.query;

    switch (type) {
      case 'attendance':
        return exports.getAttendanceReport(req, res);
      case 'performance':
        return exports.getPerformanceReport(req, res);
      case 'gradeAnalysis':
        return exports.getGradeAnalysisReport(req, res);
      case 'ranking':
        return exports.getRankingReport(req, res);
      case 'subjectPerformance':
        return exports.getSubjectPerformanceReport(req, res);
      case 'classPerformance':
        return exports.getClassPerformanceReport(req, res);
      default:
        return res.status(400).json({ success: false, message: `Unknown report type: ${type}` });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};