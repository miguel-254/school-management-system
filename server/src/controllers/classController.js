const Class = require('../models/Class');
const Stream = require('../models/Stream');
const Subject = require('../models/Subject');
const Teacher = require('../models/Teacher');
const Student = require('../models/Student');
const User = require('../models/User');
const TeacherAssignment = require('../models/TeacherAssignment');
const AuditLog = require('../models/AuditLog');

exports.getClasses = async (req, res) => {
  try {
    const { academicYear } = req.query;
    const query = {};
    if (academicYear) query.academicYear = academicYear;

    const classes = await Class.find(query)
      .populate('classTeacher', 'firstName lastName employeeId')
      .populate('academicYear', 'name year isCurrent')
      .populate('streams', 'name')
      .populate('subjects', 'name code')
      .sort({ name: 1 });

    const classesWithCounts = await Promise.all(
      classes.map(async (cls) => {
        const studentCount = await Student.countDocuments({ class: cls._id, status: 'active' });
        return { ...cls.toJSON(), studentCount };
      })
    );

    res.json({ success: true, data: classesWithCounts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getClass = async (req, res) => {
  try {
    const classDoc = await Class.findById(req.params.id)
      .populate('classTeacher', 'firstName lastName employeeId')
      .populate('academicYear', 'name year isCurrent')
      .populate('streams', 'name code')
      .populate('subjects', 'name code category');

    if (!classDoc) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }

    const studentCount = await Student.countDocuments({ class: classDoc._id, status: 'active' });

    res.json({
      success: true,
      data: { ...classDoc.toJSON(), studentCount },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createClass = async (req, res) => {
  try {
    const { name, code, description, department, academicYear, classTeacher, capacity, streams, subjects } = req.body;

    if (!name || !code) {
      return res.status(400).json({ success: false, message: 'Name and code are required' });
    }

    const existing = await Class.findOne({ code: code.toUpperCase() });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Class code already exists' });
    }

    const classDoc = await Class.create({
      name,
      code,
      description,
      department,
      academicYear,
      classTeacher,
      capacity,
      subjects: subjects || [],
    });

    if (streams && streams.length > 0) {
      const streamDocs = streams
        .filter(s => s.name)
        .map(s => ({
          name: s.name,
          code: s.code || s.name.toUpperCase().slice(0, 6),
          class: classDoc._id,
        }));
      const createdStreams = await Stream.create(streamDocs);
      classDoc.streams = createdStreams.map(s => s._id);
      await classDoc.save();
    }

    if (classTeacher) {
      await Teacher.findByIdAndUpdate(classTeacher, { classAssigned: classDoc._id });
    }

    await AuditLog.create({
      user: req.user._id,
      action: 'CREATE_CLASS',
      resource: 'Class',
      resourceId: classDoc._id,
      details: { name, code },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    const populated = await Class.findById(classDoc._id)
      .populate('classTeacher', 'firstName lastName')
      .populate('academicYear', 'name year')
      .populate('streams', 'name code')
      .populate('subjects', 'name code category');

    res.status(201).json({
      success: true,
      data: populated,
      message: 'Class created successfully',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateClass = async (req, res) => {
  try {
    const classDoc = await Class.findById(req.params.id);
    if (!classDoc) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }

    if (req.body.code !== undefined) {
      const newCode = req.body.code.toUpperCase();
      const existing = await Class.findOne({ code: newCode, _id: { $ne: req.params.id } });
      if (existing) {
        return res.status(400).json({ success: false, message: 'Class code already exists' });
      }
      classDoc.code = newCode;
    }

    const allowedFields = ['name', 'description', 'department', 'academicYear', 'classTeacher', 'capacity'];
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) classDoc[field] = req.body[field];
    }

    if (req.body.streams !== undefined) {
      await Stream.deleteMany({ class: classDoc._id });
      const streamDocs = req.body.streams
        .filter(s => s.name)
        .map(s => ({
          name: s.name,
          code: s.code || s.name.toUpperCase().slice(0, 6),
          class: classDoc._id,
        }));
      if (streamDocs.length > 0) {
        const createdStreams = await Stream.create(streamDocs);
        classDoc.streams = createdStreams.map(s => s._id);
      } else {
        classDoc.streams = [];
      }
    }

    if (req.body.subjects !== undefined) {
      classDoc.subjects = req.body.subjects;
    }

    await classDoc.save();

    const populated = await Class.findById(classDoc._id)
      .populate('classTeacher', 'firstName lastName')
      .populate('academicYear', 'name year')
      .populate('streams', 'name code')
      .populate('subjects', 'name code category');

    await AuditLog.create({
      user: req.user._id,
      action: 'UPDATE_CLASS',
      resource: 'Class',
      resourceId: classDoc._id,
      details: Object.keys(req.body),
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({
      success: true,
      data: populated,
      message: 'Class updated successfully',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteClass = async (req, res) => {
  try {
    const classDoc = await Class.findById(req.params.id);
    if (!classDoc) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }

    const studentCount = await Student.countDocuments({ class: classDoc._id, status: 'active' });
    if (studentCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete class with ${studentCount} active students`,
      });
    }

    await Stream.deleteMany({ class: classDoc._id });
    await TeacherAssignment.deleteMany({ class: classDoc._id });
    await Class.findByIdAndDelete(req.params.id);

    await AuditLog.create({
      user: req.user._id,
      action: 'DELETE_CLASS',
      resource: 'Class',
      resourceId: req.params.id,
      details: { name: classDoc.name, code: classDoc.code },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({
      success: true,
      data: {},
      message: 'Class deleted successfully',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.assignTeacher = async (req, res) => {
  try {
    const { teacherId } = req.body;

    if (!teacherId) {
      return res.status(400).json({ success: false, message: 'teacherId is required' });
    }

    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Teacher not found' });
    }

    const classDoc = await Class.findByIdAndUpdate(
      req.params.id,
      { classTeacher: teacherId },
      { new: true }
    ).populate('classTeacher', 'firstName lastName employeeId');

    if (!classDoc) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }

    await Teacher.findByIdAndUpdate(teacherId, { classAssigned: classDoc._id });

    if (teacher.user) {
      const userDoc = await User.findById(teacher.user);
      if (userDoc && userDoc.role === 'teacher') {
        userDoc.role = 'class_teacher';
        await userDoc.save();
      }
    }

    await AuditLog.create({
      user: req.user._id,
      action: 'ASSIGN_CLASS_TEACHER',
      resource: 'Class',
      resourceId: classDoc._id,
      details: { teacherId },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({
      success: true,
      data: classDoc,
      message: 'Class teacher assigned successfully',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.assignSubject = async (req, res) => {
  try {
    const { subjectId } = req.body;

    if (!subjectId) {
      return res.status(400).json({ success: false, message: 'subjectId is required' });
    }

    const subject = await Subject.findById(subjectId);
    if (!subject) {
      return res.status(404).json({ success: false, message: 'Subject not found' });
    }

    const classDoc = await Class.findById(req.params.id);
    if (!classDoc) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }

    if (classDoc.subjects.includes(subjectId)) {
      return res.status(400).json({ success: false, message: 'Subject already assigned to this class' });
    }

    classDoc.subjects.push(subjectId);
    await classDoc.save();

    const populated = await Class.findById(classDoc._id)
      .populate('subjects', 'name code category');

    await AuditLog.create({
      user: req.user._id,
      action: 'ASSIGN_SUBJECT_TO_CLASS',
      resource: 'Class',
      resourceId: classDoc._id,
      details: { subjectId },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({
      success: true,
      data: populated,
      message: 'Subject assigned to class successfully',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getClassStudents = async (req, res) => {
  try {
    const { page = 1, limit = 50, stream, status = 'active' } = req.query;

    const query = { class: req.params.id, status };

    if (stream) {
      query.stream = stream;
    } else if (req.teacherStreamIds && req.teacherStreamIds.length > 0 && req.teacherScope) {
      const classEntry = req.teacherScope.classMap[req.params.id];
      if (classEntry && !classEntry.allStreams && classEntry.streamIds.length > 0) {
        query.stream = { $in: classEntry.streamIds };
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [students, total] = await Promise.all([
      Student.find(query)
        .populate('stream', 'name')
        .sort({ lastName: 1, firstName: 1 })
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

exports.getClassSubjects = async (req, res) => {
  try {
    const classDoc = await Class.findById(req.params.id)
      .populate({
        path: 'subjects',
        select: 'name code category department',
      });

    if (!classDoc) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }

    const assignments = await TeacherAssignment.find({ class: req.params.id })
      .populate('teacher', 'firstName lastName employeeId')
      .populate('subject', 'name code')
      .populate('stream', 'name');

    res.json({
      success: true,
      data: {
        subjects: classDoc.subjects,
        assignments,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getClassStreams = async (req, res) => {
  try {
    const streams = await Stream.find({ class: req.params.id }).sort({ name: 1 });

    const assignments = await TeacherAssignment.find({ class: req.params.id, isClassTeacher: true })
      .populate('teacher', 'firstName lastName employeeId')
      .populate('stream', 'name');

    const assignmentMap = {};
    for (const a of assignments) {
      if (a.stream && typeof a.stream === 'object') {
        assignmentMap[a.stream._id.toString()] = a.teacher;
      }
    }

    const streamsWithCounts = await Promise.all(
      streams.map(async (stream) => {
        const studentCount = await Student.countDocuments({ stream: stream._id, status: 'active' });
        return { ...stream.toJSON(), studentCount, classTeacher: assignmentMap[stream._id.toString()] || null };
      })
    );

    res.json({ success: true, data: streamsWithCounts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.assignStreamTeacher = async (req, res) => {
  try {
    const { teacherId } = req.body;
    const { id, streamId } = req.params;

    if (!teacherId) {
      return res.status(400).json({ success: false, message: 'teacherId is required' });
    }

    const [classDoc, streamDoc, teacher] = await Promise.all([
      Class.findById(id),
      Stream.findById(streamId),
      Teacher.findById(teacherId),
    ]);

    if (!classDoc) return res.status(404).json({ success: false, message: 'Class not found' });
    if (!streamDoc) return res.status(404).json({ success: false, message: 'Stream not found' });
    if (!teacher) return res.status(404).json({ success: false, message: 'Teacher not found' });

    let assignment = await TeacherAssignment.findOne({ class: id, stream: streamId, isClassTeacher: true });

    if (assignment) {
      assignment.teacher = teacherId;
      await assignment.save();
    } else {
      assignment = await TeacherAssignment.create({
        teacher: teacherId,
        class: id,
        stream: streamId,
        isClassTeacher: true,
        teacherRole: 'class_teacher',
        assignedBy: req.user._id,
      });
    }

    const populated = await TeacherAssignment.findById(assignment._id)
      .populate('teacher', 'firstName lastName employeeId')
      .populate('stream', 'name code');

    if (teacher.user) {
      const userDoc = await User.findById(teacher.user);
      if (userDoc && userDoc.role === 'teacher') {
        userDoc.role = 'class_teacher';
        await userDoc.save();
      }
    }

    await AuditLog.create({
      user: req.user._id,
      action: 'ASSIGN_STREAM_TEACHER',
      resource: 'Class',
      resourceId: id,
      details: { streamId, teacherId },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({
      success: true,
      data: populated,
      message: 'Stream teacher assigned successfully',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.removeStreamTeacher = async (req, res) => {
  try {
    const { id, streamId } = req.params;

    const assignment = await TeacherAssignment.findOneAndDelete({ class: id, stream: streamId, isClassTeacher: true });

    if (!assignment) {
      return res.status(404).json({ success: false, message: 'No stream teacher assignment found' });
    }

    await AuditLog.create({
      user: req.user._id,
      action: 'REMOVE_STREAM_TEACHER',
      resource: 'Class',
      resourceId: id,
      details: { streamId },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({
      success: true,
      data: {},
      message: 'Stream teacher removed successfully',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getStreamAssignments = async (req, res) => {
  try {
    const assignments = await TeacherAssignment.find({ class: req.params.id, isClassTeacher: true })
      .populate('teacher', 'firstName lastName employeeId')
      .populate('stream', 'name code');

    res.json({ success: true, data: assignments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getStreams = async (req, res) => {
  try {
    const { ids } = req.query;
    let streams;
    if (ids) {
      const idArr = ids.split(',').filter(Boolean);
      streams = await Stream.find({ _id: { $in: idArr } }).sort({ name: 1 });
    } else {
      streams = await Stream.find().sort({ name: 1 });
    }
    res.json({ success: true, data: streams });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};