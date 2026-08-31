const Teacher = require('../models/Teacher');
const User = require('../models/User');
const Subject = require('../models/Subject');
const TeacherAssignment = require('../models/TeacherAssignment');
const Class = require('../models/Class');
const AuditLog = require('../models/AuditLog');

exports.getTeachers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      gender,
      subject,
      isActive,
      sort = '-createdAt',
    } = req.query;

    const query = {};

    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { employeeId: { $regex: search, $options: 'i' } },
      ];
    }

    if (gender) query.gender = gender;
    if (subject) query.subjects = subject;

    if (isActive !== undefined) {
      const userIds = isActive === 'true'
        ? await User.find({ isActive: true }).distinct('_id')
        : await User.find({ isActive: false }).distinct('_id');
      if (userIds.length === 0) {
        return res.json({
          success: true,
          data: { teachers: [], pagination: { page: parseInt(page), limit: parseInt(limit), total: 0, pages: 0 } },
        });
      }
      query.user = { $in: userIds };
    } else {
      const deactivatedUserIds = await User.find({ isActive: false }).distinct('_id');
      if (deactivatedUserIds.length > 0) {
        query.user = { $nin: deactivatedUserIds };
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [teachers, total] = await Promise.all([
      Teacher.find(query)
        .populate('user', 'email phone isActive role')
        .populate('subjects', 'name code')
        .populate('classAssigned', 'name code')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      Teacher.countDocuments(query),
    ]);

    const teachersWithStatus = teachers.map((t) => {
      const doc = t.toObject();
      doc.isActive = !!(t.user && t.user.isActive);
      return doc;
    });

    res.json({
      success: true,
      data: {
        teachers: teachersWithStatus,
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

exports.getTeacher = async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.params.id)
      .populate('user', 'firstName lastName email phone role isActive')
      .populate('subjects', 'name code category')
      .populate('classAssigned', 'name code');

    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Teacher not found' });
    }

    const assignments = await TeacherAssignment.find({ teacher: teacher._id })
      .populate('class', 'name code')
      .populate('subject', 'name code')
      .populate('stream', 'name')
      .populate('academicYear', 'name year')
      .populate('term', 'name');

    res.json({
      success: true,
      data: { teacher, assignments },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createTeacher = async (req, res) => {
  try {
    const { email, password, firstName, lastName, phone, gender, dateOfBirth, qualifications, subjects, address, emergencyContact, dateOfEmployment, role } = req.body;

    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ success: false, message: 'Email, password, first name and last name are required' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already exists' });
    }

    const validRoles = ['teacher', 'class_teacher', 'subject_teacher', 'academic_teacher', 'librarian'];
    const userRole = validRoles.includes(role) ? role : 'teacher';

    const plainPassword = password;

    const user = await User.create({
      email,
      password,
      role: userRole,
      firstName,
      lastName,
      phone,
    });

    if (userRole === 'librarian') {
      await AuditLog.create({
        user: req.user._id,
        action: 'CREATE_LIBRARIAN',
        resource: 'User',
        resourceId: user._id,
        details: { firstName, lastName, email },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      return res.status(201).json({
        success: true,
        data: user,
        credentials: { email, password: plainPassword },
        message: 'Librarian account created successfully. Save the credentials below — they won\'t be shown again.',
      });
    }

    const employeeCount = await Teacher.countDocuments();
    const employeeId = `TCH/${String(employeeCount + 1).padStart(4, '0')}`;

    const teacher = await Teacher.create({
      user: user._id,
      employeeId,
      firstName,
      lastName,
      gender,
      dateOfBirth,
      qualifications: typeof qualifications === 'string' ? [{ field: qualifications }] : qualifications,
      subjects,
      address: typeof address === 'string' ? { street: address } : address,
      emergencyContact,
      dateOfEmployment,
    });

    await AuditLog.create({
      user: req.user._id,
      action: 'CREATE_TEACHER',
      resource: 'Teacher',
      resourceId: teacher._id,
      details: { employeeId, firstName, lastName },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    const populated = await Teacher.findById(teacher._id)
      .populate('user', 'firstName lastName email phone role isActive')
      .populate('subjects', 'name code');

    res.status(201).json({
      success: true,
      data: populated,
      credentials: { email, password: plainPassword },
      message: 'Teacher created successfully. Save the credentials below — they won\'t be shown again.',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateTeacher = async (req, res) => {
  try {
    const allowedFields = [
      'firstName', 'lastName', 'gender', 'dateOfBirth',
      'subjects', 'emergencyContact',
      'dateOfEmployment', 'classAssigned', 'designation', 'isClassTeacher', 'role',
      'employeeId',
    ];

    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (req.body.address !== undefined) {
      updates.address = typeof req.body.address === 'string'
        ? { street: req.body.address }
        : req.body.address;
    }

    if (req.body.qualifications !== undefined) {
      updates.qualifications = typeof req.body.qualifications === 'string'
        ? [{ field: req.body.qualifications }]
        : req.body.qualifications;
    }

    const teacher = await Teacher.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    }).populate('user', 'firstName lastName email phone role isActive')
      .populate('subjects', 'name code')
      .populate('classAssigned', 'name code');

    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Teacher not found' });
    }

    const validRoles = ['teacher', 'class_teacher', 'subject_teacher', 'academic_teacher', 'librarian'];

    if (req.body.role === 'librarian') {
      const linkedUser = await User.findById(teacher.user._id || teacher.user).select('role');
      if (linkedUser && linkedUser.role !== 'headteacher') {
        linkedUser.role = 'librarian';
        await linkedUser.save();
      }
      await Teacher.findByIdAndDelete(teacher._id);

      await AuditLog.create({
        user: req.user._id,
        action: 'CONVERT_TO_LIBRARIAN',
        resource: 'User',
        resourceId: linkedUser?._id,
        details: { employeeId: teacher.employeeId },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      return res.json({
        success: true,
        data: { user: linkedUser },
        message: 'Account converted to librarian successfully. The teacher profile was removed.',
      });
    }

    const userUpdates = {};
    if (req.body.firstName) userUpdates.firstName = req.body.firstName;
    if (req.body.lastName) userUpdates.lastName = req.body.lastName;
    if (req.body.email) userUpdates.email = req.body.email;
    if (req.body.phone) userUpdates.phone = req.body.phone;
    if (req.body.role && validRoles.includes(req.body.role)) {
      const linkedUser = await User.findById(teacher.user._id || teacher.user).select('role');
      if (linkedUser && linkedUser.role !== 'headteacher') {
        userUpdates.role = req.body.role;
      }
    }

    if (Object.keys(userUpdates).length > 0) {
      await User.findByIdAndUpdate(teacher.user._id || teacher.user, userUpdates);
    }

    await AuditLog.create({
      user: req.user._id,
      action: 'UPDATE_TEACHER',
      resource: 'Teacher',
      resourceId: teacher._id,
      details: Object.keys(updates),
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({
      success: true,
      data: teacher,
      message: 'Teacher updated successfully',
    });
  } catch (error) {
    console.error('Update teacher error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteTeacher = async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.params.id);
    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Teacher not found' });
    }

    await User.findByIdAndUpdate(teacher.user, { isActive: false });

    await AuditLog.create({
      user: req.user._id,
      action: 'DELETE_TEACHER',
      resource: 'Teacher',
      resourceId: teacher._id,
      details: { employeeId: teacher.employeeId },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({
      success: true,
      data: {},
      message: 'Teacher deactivated successfully',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getTeacherAssignments = async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.params.id);
    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Teacher not found' });
    }

    const assignments = await TeacherAssignment.find({ teacher: teacher._id })
      .populate('class', 'name code')
      .populate('subject', 'name code')
      .populate('stream', 'name')
      .populate('academicYear', 'name year')
      .populate('term', 'name');

    res.json({
      success: true,
      data: assignments,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getTeacherDashboard = async (req, res) => {
  try {
    const teacher = await Teacher.findOne({ user: req.user._id });
    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Teacher profile not found' });
    }

    const assignments = await TeacherAssignment.find({ teacher: teacher._id })
      .populate('class', 'name code')
      .populate('subject', 'name code');

    const classIds = [...new Set(assignments.map((a) => a.class?._id?.toString()).filter(Boolean))];

    const Student = require('../models/Student');
    const Attendance = require('../models/Attendance');
    const Mark = require('../models/Mark');

    const hasStreamRestriction = req.teacherStreamIds && req.teacherStreamIds.length > 0 && req.teacherScope
      && !Object.values(req.teacherScope.classMap).some(c => c.allStreams);

    let streamStudentIds = null;
    if (hasStreamRestriction && classIds.length > 0) {
      streamStudentIds = await Student.find({
        class: { $in: classIds },
        stream: { $in: req.teacherStreamIds },
      }).distinct('_id');
    }

    const studentQuery = { class: { $in: classIds }, status: 'active' };
    if (streamStudentIds) studentQuery._id = { $in: streamStudentIds };
    const totalStudents = await Student.countDocuments(studentQuery);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const attendanceQuery = { class: { $in: classIds }, date: today };
    if (streamStudentIds) attendanceQuery.student = { $in: streamStudentIds };
    const todayAttendance = await Attendance.countDocuments(attendanceQuery);

    const markQuery = { class: { $in: classIds }, gradedBy: req.user._id, createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } };
    if (streamStudentIds) markQuery.student = { $in: streamStudentIds };
    const recentMarks = await Mark.countDocuments(markQuery);

    const assignmentSubjectIds = [...new Set(assignments.map((a) => a.subject?._id?.toString()).filter(Boolean))];
    const subjectsTaught = assignmentSubjectIds.length > 0
      ? await Subject.find({ _id: { $in: assignmentSubjectIds } })
      : [];

    res.json({
      success: true,
      data: {
        teacher,
        totalAssignments: assignments.length,
        classesTaught: classIds.length,
        totalStudents,
        todayAttendance,
        recentMarksEntered: recentMarks,
        subjectsTaught,
        assignments,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};