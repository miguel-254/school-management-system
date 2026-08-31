const TeacherAssignment = require('../models/TeacherAssignment');
const Teacher = require('../models/Teacher');
const Class = require('../models/Class');
const Subject = require('../models/Subject');
const Stream = require('../models/Stream');
const AcademicYear = require('../models/AcademicYear');
const Term = require('../models/Term');
const AuditLog = require('../models/AuditLog');

const POPULATE = [
  { path: 'teacher', select: 'firstName lastName employeeId' },
  { path: 'class', select: 'name code' },
  { path: 'subject', select: 'name code' },
  { path: 'stream', select: 'name code' },
  { path: 'academicYear', select: 'name year isCurrent' },
  { path: 'term', select: 'name isCurrent' },
];

exports.getAssignments = async (req, res) => {
  try {
    const {
      teacher,
      class: classId,
      subject,
      stream,
      academicYear,
      term,
      teacherRole,
      isClassTeacher,
    } = req.query;

    const query = {};
    if (teacher) query.teacher = teacher;
    if (classId) query.class = classId;
    if (subject) query.subject = subject;
    if (stream) query.stream = stream;
    if (academicYear) query.academicYear = academicYear;
    if (term) query.term = term;
    if (teacherRole) query.teacherRole = teacherRole;
    if (isClassTeacher !== undefined) query.isClassTeacher = isClassTeacher === 'true';

    const assignments = await TeacherAssignment.find(query)
      .populate(POPULATE)
      .sort({ createdAt: -1 });

    res.json({ success: true, data: assignments, count: assignments.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAssignment = async (req, res) => {
  try {
    const assignment = await TeacherAssignment.findById(req.params.id).populate(POPULATE);
    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Assignment not found' });
    }
    res.json({ success: true, data: assignment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const validateReferences = async (body) => {
  const { teacher, class: classId, subject, stream, academicYear, term } = body;

  const [teacherDoc, classDoc, subjectDoc] = await Promise.all([
    teacher ? Teacher.findById(teacher) : Promise.resolve(null),
    classId ? Class.findById(classId) : Promise.resolve(null),
    subject ? Subject.findById(subject) : Promise.resolve(null),
  ]);

  if (teacher && !teacherDoc) return { status: 404, message: 'Teacher not found' };
  if (classId && !classDoc) return { status: 404, message: 'Class not found' };
  if (subject && !subjectDoc) return { status: 404, message: 'Subject not found' };

  if (stream) {
    const streamDoc = await Stream.findById(stream);
    if (!streamDoc) return { status: 404, message: 'Stream not found' };
    if (classDoc && streamDoc.class.toString() !== classId) {
      return { status: 400, message: 'Stream does not belong to the selected class' };
    }
  }

  if (academicYear) {
    const yearDoc = await AcademicYear.findById(academicYear);
    if (!yearDoc) return { status: 404, message: 'Academic year not found' };
  }

  if (term) {
    const termDoc = await Term.findById(term);
    if (!termDoc) return { status: 404, message: 'Term not found' };
  }

  return null;
};

const findConflict = async (body, excludeId) => {
  const { teacher, class: classId, subject, stream } = body;

  const query = {
    teacher,
    class: classId,
    subject: subject || { $exists: false },
  };
  if (excludeId) query._id = { $ne: excludeId };

  const existing = await TeacherAssignment.find(query);

  for (const a of existing) {
    const scopeOverlaps = !a.stream || !stream || a.stream.toString() === stream.toString();
    if (scopeOverlaps) return a;
  }
  return null;
};

exports.createAssignment = async (req, res) => {
  try {
    const { teacher, class: classId, subject, stream, academicYear, term, teacherRole, isClassTeacher } = req.body;

    if (!teacher || !classId) {
      return res.status(400).json({ success: false, message: 'Teacher and class are required' });
    }
    if (!isClassTeacher && !subject) {
      return res.status(400).json({ success: false, message: 'Subject is required for teaching assignments' });
    }

    const refError = await validateReferences(req.body);
    if (refError) {
      return res.status(refError.status).json({ success: false, message: refError.message });
    }

    const conflict = await findConflict(req.body);
    if (conflict) {
      return res.status(400).json({
        success: false,
        message: 'This teacher is already assigned to the same class and subject (overlapping stream scope)',
      });
    }

    const assignment = await TeacherAssignment.create({
      teacher,
      class: classId,
      subject: subject || undefined,
      stream: stream || undefined,
      academicYear: academicYear || undefined,
      term: term || undefined,
      teacherRole: teacherRole || 'subject_teacher',
      isClassTeacher: isClassTeacher || false,
      assignedBy: req.user._id,
    });

    await AuditLog.create({
      user: req.user._id,
      action: 'CREATE_ASSIGNMENT',
      resource: 'TeacherAssignment',
      resourceId: assignment._id,
      details: { teacher, class: classId, subject, stream, academicYear, term },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    const populated = await TeacherAssignment.findById(assignment._id).populate(POPULATE);
    res.status(201).json({
      success: true,
      data: populated,
      message: 'Assignment created successfully',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateAssignment = async (req, res) => {
  try {
    const assignment = await TeacherAssignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Assignment not found' });
    }

    const { teacher, class: classId, subject, stream, academicYear, term, teacherRole, isClassTeacher } = req.body;

    const next = {
      teacher: teacher !== undefined ? teacher : assignment.teacher,
      class: classId !== undefined ? classId : assignment.class,
      subject: subject !== undefined ? subject : assignment.subject,
      stream: stream !== undefined ? stream : assignment.stream,
      academicYear: academicYear !== undefined ? academicYear : assignment.academicYear,
      term: term !== undefined ? term : assignment.term,
      isClassTeacher: isClassTeacher !== undefined ? isClassTeacher : assignment.isClassTeacher,
    };

    if (!next.isClassTeacher && !next.subject) {
      return res.status(400).json({ success: false, message: 'Subject is required for teaching assignments' });
    }

    const refError = await validateReferences(next);
    if (refError) {
      return res.status(refError.status).json({ success: false, message: refError.message });
    }

    const conflict = await findConflict(next, assignment._id);
    if (conflict) {
      return res.status(400).json({
        success: false,
        message: 'This teacher is already assigned to the same class and subject (overlapping stream scope)',
      });
    }

    assignment.teacher = next.teacher;
    assignment.class = next.class;
    assignment.subject = next.subject;
    assignment.stream = next.stream;
    assignment.academicYear = next.academicYear;
    assignment.term = next.term;
    assignment.isClassTeacher = next.isClassTeacher;
    if (teacherRole !== undefined) assignment.teacherRole = teacherRole;
    await assignment.save();

    await AuditLog.create({
      user: req.user._id,
      action: 'UPDATE_ASSIGNMENT',
      resource: 'TeacherAssignment',
      resourceId: assignment._id,
      details: next,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    const populated = await TeacherAssignment.findById(assignment._id).populate(POPULATE);
    res.json({
      success: true,
      data: populated,
      message: 'Assignment updated successfully',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteAssignment = async (req, res) => {
  try {
    const assignment = await TeacherAssignment.findByIdAndDelete(req.params.id);
    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Assignment not found' });
    }

    await AuditLog.create({
      user: req.user._id,
      action: 'DELETE_ASSIGNMENT',
      resource: 'TeacherAssignment',
      resourceId: assignment._id,
      details: { teacher: assignment.teacher, class: assignment.class, subject: assignment.subject },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({
      success: true,
      data: {},
      message: 'Assignment deleted successfully',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
