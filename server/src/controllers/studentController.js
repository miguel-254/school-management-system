const Student = require('../models/Student');
const User = require('../models/User');
const Class = require('../models/Class');
const Stream = require('../models/Stream');
const Mark = require('../models/Mark');
const ReportCard = require('../models/ReportCard');
const Attendance = require('../models/Attendance');
const AuditLog = require('../models/AuditLog');
const path = require('path');
const fs = require('fs');

exports.getStudents = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      class: className,
      stream,
      status,
      gender,
      sort = '-createdAt',
    } = req.query;

    const query = {};

    if (req.studentClassIds) {
      query.class = { $in: req.studentClassIds };
    }

    if (req.teacherStreamIds && req.teacherStreamIds.length > 0 && req.teacherScope) {
      const hasUnrestricted = Object.values(req.teacherScope.classMap).some(c => c.allStreams);
      if (!hasUnrestricted) {
        query.stream = { $in: req.teacherStreamIds };
      }
    }

    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { admissionNumber: { $regex: search, $options: 'i' } },
      ];
    }

    if (className) {
      if (req.studentClassIds) {
        query.class = { $in: req.studentClassIds.filter(id => id.toString() === className) };
        if (query.class.$in.length === 0) {
          return res.json({ success: true, data: { students: [], pagination: { page: parseInt(page), limit: parseInt(limit), total: 0, pages: 0 } } });
        }
      } else {
        query.class = className;
      }
    }
    if (stream) query.stream = stream;
    if (status) {
      query.status = status;
    } else {
      query.status = { $ne: 'archived' };
    }
    if (gender) query.gender = gender;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [students, total] = await Promise.all([
      Student.find(query)
        .populate('class', 'name code')
        .populate('stream', 'name')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      Student.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: {
        students,
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

exports.getStudent = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id)
      .populate('class', 'name code')
      .populate('stream', 'name');

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const marks = await Mark.find({ student: student._id })
      .populate('assessment', 'name type')
      .populate('subject', 'name code')
      .sort({ createdAt: -1 });

    const reportCards = await ReportCard.find({ student: student._id })
      .populate('academicYear', 'name year')
      .populate('term', 'name')
      .populate('class', 'name')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: { student, marks, reportCards },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createStudent = async (req, res) => {
  try {
    const { email, password, firstName, lastName, gender, dateOfBirth, class: classId, stream, guardianInfo, address, emergencyContact, medicalInfo, previousSchool } = req.body;

    if (!firstName || !lastName || !gender) {
      return res.status(400).json({ success: false, message: 'First name, last name and gender are required' });
    }

    let user = null;
    let plainPassword = null;
    if (email) {
      plainPassword = password || 'student123';
      user = await User.create({
        email,
        password: plainPassword,
        role: 'student',
        firstName,
        lastName,
      });
    }

    const student = await Student.create({
      user: user?._id,
      firstName,
      lastName,
      gender,
      dateOfBirth,
      class: classId,
      stream,
      guardianInfo,
      address,
      emergencyContact,
      medicalInfo,
      previousSchool,
    });

    await AuditLog.create({
      user: req.user._id,
      action: 'CREATE_STUDENT',
      resource: 'Student',
      resourceId: student._id,
      details: { admissionNumber: student.admissionNumber, firstName, lastName },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    const populated = await Student.findById(student._id)
      .populate('class', 'name')
      .populate('stream', 'name');

    res.status(201).json({
      success: true,
      data: populated,
      ...(plainPassword ? { credentials: { email, password: plainPassword } } : {}),
      message: plainPassword
        ? 'Student created successfully. Save the credentials below — they won\'t be shown again.'
        : 'Student created successfully (no login account - no email provided)',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateStudent = async (req, res) => {
  try {
    const allowedFields = [
      'firstName', 'lastName', 'gender', 'dateOfBirth',
      'class', 'stream', 'guardianInfo', 'address',
      'emergencyContact', 'medicalInfo', 'status', 'previousSchool',
      'schoolFees',
    ];

    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    const student = await Student.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    }).populate('class', 'name')
      .populate('stream', 'name');

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    await AuditLog.create({
      user: req.user._id,
      action: 'UPDATE_STUDENT',
      resource: 'Student',
      resourceId: student._id,
      details: Object.keys(updates),
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({
      success: true,
      data: student,
      message: 'Student updated successfully',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteStudent = async (req, res) => {
  try {
    const student = await Student.findByIdAndUpdate(
      req.params.id,
      { status: 'archived' },
      { new: true }
    );

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    if (student.user) {
      await User.findByIdAndUpdate(student.user, { isActive: false });
    }

    await AuditLog.create({
      user: req.user._id,
      action: 'ARCHIVE_STUDENT',
      resource: 'Student',
      resourceId: student._id,
      details: { admissionNumber: student.admissionNumber },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({
      success: true,
      data: {},
      message: 'Student archived successfully',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.uploadPhoto = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'photos');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filename = `student_${req.params.id}_${Date.now()}${path.extname(req.file.originalname)}`;
    const filePath = path.join(uploadDir, filename);

    fs.writeFileSync(filePath, req.file.buffer);

    const photoUrl = `/uploads/photos/${filename}`;

    const student = await Student.findByIdAndUpdate(
      req.params.id,
      { passportPhoto: photoUrl },
      { new: true }
    ).populate('class', 'name').populate('stream', 'name');

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    res.json({
      success: true,
      data: student,
      message: 'Photo uploaded successfully',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.bulkImport = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload a CSV or Excel file' });
    }

    const XLSX = require('xlsx');
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    if (!rows || rows.length === 0) {
      return res.status(400).json({ success: false, message: 'File is empty' });
    }

    const results = { imported: 0, skipped: 0, errors: [] };

    for (const row of rows) {
      try {
        if (!row.firstName || !row.lastName || !row.gender) {
          results.skipped++;
          results.errors.push({ row: rows.indexOf(row) + 1, reason: 'Missing required fields (firstName, lastName, gender)' });
          continue;
        }

        let classDoc = null;
        if (row.class) {
          classDoc = await Class.findOne({ name: { $regex: `^${row.class}$`, $options: 'i' } });
        }

        let streamDoc = null;
        if (row.stream && classDoc) {
          streamDoc = await Stream.findOne({ name: { $regex: `^${row.stream}$`, $options: 'i' }, class: classDoc._id });
        }

        await Student.create({
          firstName: row.firstName,
          lastName: row.lastName,
          gender: row.gender.toLowerCase(),
          dateOfBirth: row.dateOfBirth ? new Date(row.dateOfBirth) : undefined,
          class: classDoc?._id,
          stream: streamDoc?._id,
          guardianInfo: {
            name: row.guardianName,
            phone: row.guardianPhone,
            email: row.guardianEmail,
            relationship: row.guardianRelationship,
          },
          previousSchool: row.previousSchool,
        });

        results.imported++;
      } catch (err) {
        results.skipped++;
        results.errors.push({ row: rows.indexOf(row) + 1, reason: err.message });
      }
    }

    await AuditLog.create({
      user: req.user._id,
      action: 'BULK_IMPORT_STUDENTS',
      resource: 'Student',
      details: { imported: results.imported, skipped: results.skipped },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({
      success: true,
      data: results,
      message: `Imported ${results.imported} students, skipped ${results.skipped}`,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.promoteStudents = async (req, res) => {
  try {
    const { studentIds, targetClassId, targetStreamId, fromClass, toClass } = req.body;

    let ids = studentIds;
    let targetId = targetClassId;
    let streamId = targetStreamId;

    if (fromClass && toClass) {
      const students = await Student.find({ class: fromClass, status: 'active' }).select('_id');
      ids = students.map(s => s._id);
      targetId = toClass;
    }

    if (!ids || !ids.length || !targetId) {
      return res.status(400).json({ success: false, message: 'studentIds and targetClassId are required' });
    }

    const result = await Student.updateMany(
      { _id: { $in: ids } },
      {
        $set: {
          class: targetId,
          ...(streamId && { stream: streamId }),
        },
      }
    );

    await AuditLog.create({
      user: req.user._id,
      action: 'PROMOTE_STUDENTS',
      resource: 'Student',
      details: { count: ids.length, targetClass: targetId },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({
      success: true,
      data: { modifiedCount: result.modifiedCount },
      message: `${result.modifiedCount} students promoted successfully`,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getStudentHistory = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const reportCards = await ReportCard.find({ student: student._id })
      .populate('academicYear', 'name year')
      .populate('term', 'name')
      .populate('class', 'name')
      .populate('subjects.subject', 'name code')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: {
        student: { _id: student._id, firstName: student.firstName, lastName: student.lastName, admissionNumber: student.admissionNumber },
        academicHistory: student.academicHistory,
        reportCards,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getGuardianInfo = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id).select('firstName lastName admissionNumber guardianInfo');
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    res.json({
      success: true,
      data: {
        student: `${student.firstName} ${student.lastName}`,
        admissionNumber: student.admissionNumber,
        guardianInfo: student.guardianInfo,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};