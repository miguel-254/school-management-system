const Subject = require('../models/Subject');
const AuditLog = require('../models/AuditLog');

const TEACHER_SCOPED_ROLES = ['teacher', 'subject_teacher', 'class_teacher'];

const getTeacherSubjectScope = async (userId) => {
  const Teacher = require('../models/Teacher');
  const TeacherAssignment = require('../models/TeacherAssignment');

  const teacher = await Teacher.findOne({ user: userId });
  if (!teacher) return [];

  return TeacherAssignment.find({ teacher: teacher._id, subject: { $exists: true } }).distinct('subject');
};

exports.getSubjects = async (req, res) => {
  try {
    const { department, category, sort = 'name' } = req.query;
    const query = {};
    if (department) query.department = department;
    if (category) query.category = category;

    if (TEACHER_SCOPED_ROLES.includes(req.user.role)) {
      const subjectIds = await getTeacherSubjectScope(req.user._id);
      query._id = { $in: subjectIds };
    }

    const subjects = await Subject.find(query).sort(sort);
    res.json({ success: true, data: subjects });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getSubject = async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.id);
    if (!subject) {
      return res.status(404).json({ success: false, message: 'Subject not found' });
    }
    res.json({ success: true, data: subject });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createSubject = async (req, res) => {
  try {
    const { name, code, description, department, category, credits } = req.body;

    if (!name || !code) {
      return res.status(400).json({ success: false, message: 'Name and code are required' });
    }

    const existing = await Subject.findOne({ code: code.toUpperCase() });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Subject code already exists' });
    }

    const subject = await Subject.create({ name, code, description, department, category, credits });

    await AuditLog.create({
      user: req.user._id,
      action: 'CREATE_SUBJECT',
      resource: 'Subject',
      resourceId: subject._id,
      details: { name, code },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.status(201).json({
      success: true,
      data: subject,
      message: 'Subject created successfully',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateSubject = async (req, res) => {
  try {
    const allowedFields = ['name', 'description', 'department', 'category', 'credits'];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    const subject = await Subject.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });

    if (!subject) {
      return res.status(404).json({ success: false, message: 'Subject not found' });
    }

    await AuditLog.create({
      user: req.user._id,
      action: 'UPDATE_SUBJECT',
      resource: 'Subject',
      resourceId: subject._id,
      details: Object.keys(updates),
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({
      success: true,
      data: subject,
      message: 'Subject updated successfully',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteSubject = async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.id);
    if (!subject) {
      return res.status(404).json({ success: false, message: 'Subject not found' });
    }

    const TeacherAssignment = require('../models/TeacherAssignment');
    const Mark = require('../models/Mark');

    const assignmentCount = await TeacherAssignment.countDocuments({ subject: subject._id });
    const markCount = await Mark.countDocuments({ subject: subject._id });

    if (assignmentCount > 0 || markCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete subject with ${assignmentCount} assignments and ${markCount} marks linked to it`,
      });
    }

    await Subject.findByIdAndDelete(req.params.id);

    await AuditLog.create({
      user: req.user._id,
      action: 'DELETE_SUBJECT',
      resource: 'Subject',
      resourceId: req.params.id,
      details: { name: subject.name, code: subject.code },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({
      success: true,
      data: {},
      message: 'Subject deleted successfully',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};