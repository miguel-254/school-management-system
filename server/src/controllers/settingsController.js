const SchoolSetting = require('../models/SchoolSetting');
const AuditLog = require('../models/AuditLog');
const User = require('../models/User');
const Teacher = require('../models/Teacher');
const Student = require('../models/Student');
const Class = require('../models/Class');
const Subject = require('../models/Subject');
const Attendance = require('../models/Attendance');
const Mark = require('../models/Mark');
const Assessment = require('../models/Assessment');
const GradeScale = require('../models/GradeScale');
const ReportCard = require('../models/ReportCard');
const Notification = require('../models/Notification');
const AcademicYear = require('../models/AcademicYear');
const Term = require('../models/Term');
const TeacherAssignment = require('../models/TeacherAssignment');
const Stream = require('../models/Stream');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

exports.getSchoolSettings = async (req, res) => {
  try {
    let settings = await SchoolSetting.findOne();
    if (!settings) {
      settings = await SchoolSetting.create({ schoolName: 'My School', schoolCode: 'SCH001' });
    }
    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateSchoolSettings = async (req, res) => {
  try {
    const allowedFields = [
      'schoolName', 'address', 'phone', 'email', 'website',
      'motto', 'principalName', 'gradingSystem', 'academicYearConfig',
      'reportCardConfig', 'sessionTimeout', 'theme', 'timezone', 'locale',
    ];

    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    let settings = await SchoolSetting.findOne();
    if (!settings) {
      settings = await SchoolSetting.create({ schoolName: 'My School', schoolCode: 'SCH001', ...updates });
    } else {
      Object.assign(settings, updates);
      await settings.save();
    }

    await AuditLog.create({
      user: req.user._id,
      action: 'UPDATE_SCHOOL_SETTINGS',
      resource: 'SchoolSetting',
      resourceId: settings._id,
      details: Object.keys(updates),
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({
      success: true,
      data: settings,
      message: 'School settings updated successfully',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.uploadLogo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload a logo image' });
    }

    const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'logo');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filename = `logo_${Date.now()}${path.extname(req.file.originalname)}`;
    const filePath = path.join(uploadDir, filename);
    fs.writeFileSync(filePath, req.file.buffer);

    const logoUrl = `/uploads/logo/${filename}`;

    let settings = await SchoolSetting.findOne();
    if (!settings) {
      settings = await SchoolSetting.create({ schoolName: 'My School', schoolCode: 'SCH001', logo: logoUrl });
    } else {
      if (settings.logo) {
        const oldPath = path.join(__dirname, '..', '..', settings.logo);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }
      settings.logo = logoUrl;
      await settings.save();
    }

    res.json({
      success: true,
      data: settings,
      message: 'Logo uploaded successfully',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.backupDatabase = async (req, res) => {
  try {
    const backupDir = path.join(__dirname, '..', '..', 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `backup_${timestamp}.json`);

    const data = {
      schoolSettings: await SchoolSetting.findOne().lean(),
      users: await User.find().lean(),
      teachers: await Teacher.find().lean(),
      students: await Student.find().lean(),
      classes: await Class.find().lean(),
      streams: await Stream.find().lean(),
      subjects: await Subject.find().lean(),
      academicYears: await AcademicYear.find().lean(),
      terms: await Term.find().lean(),
      assessments: await Assessment.find().lean(),
      marks: await Mark.find().lean(),
      attendance: await Attendance.find().lean(),
      gradeScales: await GradeScale.find().lean(),
      reportCards: await ReportCard.find().lean(),
      notifications: await Notification.find().lean(),
      teacherAssignments: await TeacherAssignment.find().lean(),
      audits: await AuditLog.find().lean(),
      exportedAt: new Date().toISOString(),
    };

    fs.writeFileSync(backupPath, JSON.stringify(data, null, 2));

    await AuditLog.create({
      user: req.user._id,
      action: 'BACKUP_DATABASE',
      resource: 'SchoolSetting',
      details: { filename: `backup_${timestamp}.json`, size: Buffer.byteLength(JSON.stringify(data)) },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({
      success: true,
      data: {
        filename: `backup_${timestamp}.json`,
        collections: Object.keys(data).filter((k) => k !== 'exportedAt'),
        exportedAt: data.exportedAt,
      },
      message: 'Database backup completed successfully',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.restoreDatabase = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload a backup JSON file' });
    }

    const data = JSON.parse(req.file.buffer.toString());

    const collections = [
      { model: SchoolSetting, name: 'schoolSetting' },
      { model: User, name: 'users' },
      { model: Teacher, name: 'teachers' },
      { model: Student, name: 'students' },
      { model: Class, name: 'classes' },
      { model: Stream, name: 'streams' },
      { model: Subject, name: 'subjects' },
      { model: AcademicYear, name: 'academicYears' },
      { model: Term, name: 'terms' },
      { model: Assessment, name: 'assessments' },
      { model: Mark, name: 'marks' },
      { model: Attendance, name: 'attendance' },
      { model: GradeScale, name: 'gradeScales' },
      { model: ReportCard, name: 'reportCards' },
      { model: Notification, name: 'notifications' },
      { model: TeacherAssignment, name: 'teacherAssignments' },
      { model: AuditLog, name: 'audits' },
    ];

    const results = [];

    for (const { model, name } of collections) {
      if (data[name] && Array.isArray(data[name]) && data[name].length > 0) {
        await model.deleteMany({});
        await model.insertMany(data[name]);
        results.push({ collection: name, restored: data[name].length });
      }
    }

    await AuditLog.create({
      user: req.user._id,
      action: 'RESTORE_DATABASE',
      resource: 'SchoolSetting',
      details: results,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({
      success: true,
      data: results,
      message: `Database restored with ${results.length} collections from backup`,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const buildAuditQuery = async (queryParams) => {
  const {
    user: userId,
    action,
    resource,
    startDate,
    endDate,
  } = queryParams;

  const query = {};

  if (userId) {
    const regex = new RegExp(userId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const conditions = [
      { firstName: regex },
      { lastName: regex },
      { email: regex },
    ];
    if (mongoose.isValidObjectId(userId)) {
      conditions.push({ _id: userId });
    }
    const matchedUserIds = await User.find({ $or: conditions }).distinct('_id');
    if (matchedUserIds.length === 0) {
      query.user = { _id: null };
    } else {
      query.user = { $in: matchedUserIds };
    }
  }

  if (action) query.action = { $regex: action, $options: 'i' };
  if (resource) query.resource = resource;
  if (startDate || endDate) {
    query.timestamp = {};
    if (startDate) query.timestamp.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query.timestamp.$lte = end;
    }
  }

  return query;
};

exports.getAuditLogs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      sort = '-timestamp',
    } = req.query;

    const query = await buildAuditQuery(req.query);

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .populate('user', 'firstName lastName email role')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      AuditLog.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: {
        logs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.exportAuditLogs = async (req, res) => {
  try {
    if (req.query.export !== 'csv') {
      return exports.getAuditLogs(req, res);
    }

    const query = await buildAuditQuery(req.query);

    const logs = await AuditLog.find(query)
      .populate('user', 'firstName lastName email role')
      .sort('-timestamp');

    const escapeCsv = (value) => {
      if (value == null) return '';
      const str = typeof value === 'object' ? JSON.stringify(value) : String(value);
      if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
      return str;
    };

    const headers = ['User', 'Action', 'Resource', 'Resource ID', 'Details', 'IP Address', 'User Agent', 'Timestamp'];

    const rows = logs.map((log) => {
      const userName = log.user && typeof log.user === 'object'
        ? log.user.fullName || `${log.user.firstName || ''} ${log.user.lastName || ''}`.trim() || log.user.email
        : log.user || 'System';
      return [
        escapeCsv(userName),
        escapeCsv(log.action),
        escapeCsv(log.resource),
        escapeCsv(log.resourceId),
        escapeCsv(log.details),
        escapeCsv(log.ipAddress),
        escapeCsv(log.userAgent),
        escapeCsv(log.timestamp ? new Date(log.timestamp).toISOString() : ''),
      ].join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.csv"`);
    res.status(200).send(csv);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
