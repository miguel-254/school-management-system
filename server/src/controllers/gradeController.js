const GradeScale = require('../models/GradeScale');
const Mark = require('../models/Mark');
const Student = require('../models/Student');
const Assessment = require('../models/Assessment');
const gradingEngine = require('../utils/gradingEngine');
const AuditLog = require('../models/AuditLog');

exports.getGradeScales = async (req, res) => {
  try {
    const { system, isActive, sort = 'minScore' } = req.query;
    const query = {};
    if (system) query.system = system;
    if (isActive !== undefined) query.isActive = isActive === 'true';

    const scales = await GradeScale.find(query).sort(sort);
    res.json({ success: true, data: scales });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createGradeScale = async (req, res) => {
  try {
    const { name, code, minScore, maxScore, gradePoint, description, remark, system } = req.body;

    if (!name || !code || minScore === undefined || maxScore === undefined || gradePoint === undefined || !system) {
      return res.status(400).json({
        success: false,
        message: 'name, code, minScore, maxScore, gradePoint and system are required',
      });
    }

    if (minScore >= maxScore) {
      return res.status(400).json({
        success: false,
        message: 'minScore must be less than maxScore',
      });
    }

    const overlapping = await GradeScale.findOne({
      system,
      isActive: true,
      $or: [
        { minScore: { $lte: maxScore, $gte: minScore } },
        { maxScore: { $gte: minScore, $lte: maxScore } },
        { minScore: { $gte: minScore }, maxScore: { $lte: maxScore } },
      ],
    });

    if (overlapping) {
      return res.status(400).json({
        success: false,
        message: `Grade scale overlaps with existing: ${overlapping.name} (${overlapping.minScore}-${overlapping.maxScore})`,
      });
    }

    const scale = await GradeScale.create({ name, code, minScore, maxScore, gradePoint, description, remark, system });

    await AuditLog.create({
      user: req.user._id,
      action: 'CREATE_GRADE_SCALE',
      resource: 'GradeScale',
      resourceId: scale._id,
      details: { name, code, system },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.status(201).json({
      success: true,
      data: scale,
      message: 'Grade scale created successfully',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateGradeScale = async (req, res) => {
  try {
    const allowedFields = ['name', 'minScore', 'maxScore', 'gradePoint', 'description', 'remark', 'isActive'];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    const scale = await GradeScale.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });

    if (!scale) {
      return res.status(404).json({ success: false, message: 'Grade scale not found' });
    }

    await AuditLog.create({
      user: req.user._id,
      action: 'UPDATE_GRADE_SCALE',
      resource: 'GradeScale',
      resourceId: scale._id,
      details: Object.keys(updates),
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({
      success: true,
      data: scale,
      message: 'Grade scale updated successfully',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteGradeScale = async (req, res) => {
  try {
    const scale = await GradeScale.findByIdAndDelete(req.params.id);
    if (!scale) {
      return res.status(404).json({ success: false, message: 'Grade scale not found' });
    }

    await AuditLog.create({
      user: req.user._id,
      action: 'DELETE_GRADE_SCALE',
      resource: 'GradeScale',
      resourceId: req.params.id,
      details: { name: scale.name, code: scale.code },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({
      success: true,
      data: {},
      message: 'Grade scale deleted successfully',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.calculateGrades = async (req, res) => {
  try {
    const { class: classId, subject: subjectId, assessment: assessmentId, term, academicYear } = req.body;

    if (!classId || !subjectId) {
      return res.status(400).json({ success: false, message: 'class and subject are required' });
    }

    const gradeScales = await GradeScale.find({ isActive: true, system: 'percentage' }).sort({ minScore: -1 });

    if (gradeScales.length === 0) {
      return res.status(400).json({ success: false, message: 'No active grade scales found' });
    }

    const query = { class: classId, subject: subjectId };
    if (assessmentId) query.assessment = assessmentId;
    if (term) query.term = term;
    if (academicYear) query.academicYear = academicYear;

    if (req.teacherStreamIds && req.teacherStreamIds.length > 0 && req.teacherScope) {
      const classEntry = req.teacherScope.classMap[classId];
      if (classEntry && !classEntry.allStreams && classEntry.streamIds.length > 0) {
        query.stream = { $in: classEntry.streamIds };
      }
    }

    const marks = await Mark.find(query).populate('assessment', 'maxScore');

    const updated = [];
    for (const mark of marks) {
      const maxScore = mark.totalScore || mark.assessment?.maxScore || 100;
      const percentage = (mark.score / maxScore) * 100;
      const gradeResult = gradingEngine.calculateGrade(percentage, gradeScales);

      mark.grade = gradeResult.grade;
      mark.gradePoint = gradeResult.gradePoint;
      mark.remarks = gradeResult.remarks;
      await mark.save();
      updated.push(mark);
    }

    res.json({
      success: true,
      data: { updated: updated.length },
      message: `Grades calculated for ${updated.length} marks`,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getGradeReport = async (req, res) => {
  try {
    const { class: classId, subject: subjectId, assessment, term, academicYear } = req.query;

    const match = {};
    if (classId) match.class = new (require('mongoose').Types.ObjectId)(classId);
    if (subjectId) match.subject = new (require('mongoose').Types.ObjectId)(subjectId);
    if (assessment) match.assessment = new (require('mongoose').Types.ObjectId)(assessment);
    if (term) match.term = new (require('mongoose').Types.ObjectId)(term);
    if (academicYear) match.academicYear = new (require('mongoose').Types.ObjectId)(academicYear);

    if (req.teacherStreamIds && req.teacherStreamIds.length > 0 && req.teacherScope) {
      const hasUnrestricted = Object.values(req.teacherScope.classMap).some(c => c.allStreams);
      if (!hasUnrestricted) {
        match.stream = { $in: req.teacherStreamIds.map(id => new (require('mongoose').Types.ObjectId)(id)) };
      }
    }

    const distribution = await Mark.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$grade',
          count: { $sum: 1 },
          averageScore: { $avg: '$score' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const gradeScales = await GradeScale.find({ isActive: true, system: 'percentage' });

    const stats = await Mark.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalMarks: { $sum: 1 },
          highestScore: { $max: '$score' },
          lowestScore: { $min: '$score' },
          averageScore: { $avg: '$score' },
        },
      },
    ]);

    res.json({
      success: true,
      data: {
        distribution,
        stats: stats[0] || { totalMarks: 0, highestScore: 0, lowestScore: 0, averageScore: 0 },
        gradeScales,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getStudentGrades = async (req, res) => {
  try {
    const { academicYear, term } = req.query;

    const query = { student: req.params.id };
    if (academicYear) query.academicYear = academicYear;
    if (term) query.term = term;

    const marks = await Mark.find(query)
      .populate('subject', 'name code')
      .populate('assessment', 'name type weight');

    const gradeScales = await GradeScale.find({ isActive: true, system: 'percentage' });

    const groupedBySubject = marks.reduce((acc, mark) => {
      const subId = mark.subject?._id?.toString() || mark.subject?.toString();
      if (!acc[subId]) {
        acc[subId] = {
          subject: mark.subject,
          marks: [],
          total: 0,
        };
      }
      acc[subId].marks.push(mark);
      acc[subId].total += mark.score || 0;
      return acc;
    }, {});

    const subjectGrades = Object.values(groupedBySubject).map((g) => {
      const avg = g.marks.length > 0 ? parseFloat((g.total / g.marks.length).toFixed(2)) : 0;
      const grade = gradingEngine.calculateGrade(avg, gradeScales);
      return { subject: g.subject, marks: g.marks, average: avg, grade: grade.grade, gradePoint: grade.gradePoint };
    });

    const overallAverage = subjectGrades.length > 0
      ? parseFloat(subjectGrades.reduce((s, g) => s + g.average, 0) / subjectGrades.length).toFixed(2)
      : 0;

    res.json({
      success: true,
      data: {
        subjectGrades,
        overallAverage: parseFloat(overallAverage),
        totalSubjects: subjectGrades.length,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};