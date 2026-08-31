const Teacher = require('../models/Teacher');
const TeacherAssignment = require('../models/TeacherAssignment');
const Student = require('../models/Student');
const Class = require('../models/Class');
const ReportCard = require('../models/ReportCard');

const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Role '${req.user.role}' is not authorized to access this resource`,
      });
    }

    next();
  };
};

const authorizeAttendance = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }
  if (req.user.role !== 'class_teacher' && req.user.role !== 'headteacher') {
    return res.status(403).json({ success: false, message: 'Only class teachers can manage attendance' });
  }
  next();
};

const authorizeAssessmentCreation = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }
  if (req.user.role !== 'academic_teacher') {
    return res.status(403).json({ success: false, message: 'Only academic teachers can create assessments' });
  }
  next();
};

const authorizeSubjectAccess = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }
  if (req.user.role === 'headteacher' || req.user.role === 'academic_teacher') {
    return next();
  }
  if (req.user.role === 'subject_teacher' || req.user.role === 'class_teacher') {
    const teacher = await Teacher.findOne({ user: req.user._id });
    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Teacher profile not found' });
    }
    const subjectId = req.body.subject || req.query.subject || req.params.subjectId;
    const classId = req.body.class || req.query.class || req.params.classId;
    const streamId = req.body.stream || req.query.stream;

    if (subjectId && classId) {
      const query = { teacher: teacher._id, subject: subjectId, class: classId };
      if (streamId) query.stream = streamId;

      const assignment = await TeacherAssignment.findOne(query);
      if (!assignment) {
        const isClassTeacher = await Class.findOne({ _id: classId, classTeacher: teacher._id });
        if (!isClassTeacher) {
          return res.status(403).json({ success: false, message: 'You are not assigned to this subject in this class' });
        }
      }
    } else if (subjectId && !classId) {
      const assignment = await TeacherAssignment.findOne({ teacher: teacher._id, subject: subjectId });
      if (!assignment) {
        return res.status(403).json({ success: false, message: 'You are not assigned to this subject' });
      }
    } else if (!subjectId && classId) {
      const isClassTeacher = await Class.findOne({ _id: classId, classTeacher: teacher._id });
      const assignment = await TeacherAssignment.findOne({ teacher: teacher._id, class: classId });
      if (!isClassTeacher && !assignment) {
        return res.status(403).json({ success: false, message: 'You are not assigned to this class' });
      }
    }
  }
  next();
};

const authorizeStudentEdit = async (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Not authenticated' });

  if (req.user.role === 'headteacher') return next();

  if (['class_teacher', 'academic_teacher', 'teacher'].includes(req.user.role)) {
    try {
      const teacher = await Teacher.findOne({ user: req.user._id });
      if (!teacher) return res.status(404).json({ success: false, message: 'Teacher profile not found' });

      const studentId = req.params.id;
      if (!studentId) return next();

      const student = await Student.findById(studentId);
      if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

      if (!student.class) return res.status(400).json({ success: false, message: 'Student has no class assigned' });

      const [classDoc, assignments] = await Promise.all([
        Class.findById(student.class).select('classTeacher'),
        TeacherAssignment.find({
          teacher: teacher._id,
          class: student.class,
          $or: [
            { isClassTeacher: true },
            { teacherRole: 'class_teacher' },
            { teacherRole: 'academic_teacher' },
          ],
        }),
      ]);

      if (assignments.length === 0) {
        const isClassTeacher = classDoc && classDoc.classTeacher && classDoc.classTeacher.toString() === teacher._id.toString();
        if (!isClassTeacher) {
          return res.status(403).json({ success: false, message: 'You are not assigned to this student\'s class' });
        }
        return next();
      }

      const hasStreamAccess = assignments.some(a => {
        if (!a.stream) return true;
        return student.stream && a.stream.toString() === student.stream.toString();
      });

      if (!hasStreamAccess) {
        return res.status(403).json({ success: false, message: 'You are not assigned to this student\'s stream' });
      }
      return next();
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  return res.status(403).json({ success: false, message: 'Not authorized to edit students' });
};

const scopeStudentsByTeacher = async (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Not authenticated' });

  if (req.user.role === 'headteacher') return next();

  if (['teacher', 'class_teacher', 'academic_teacher', 'subject_teacher'].includes(req.user.role)) {
    try {
      const teacher = await Teacher.findOne({ user: req.user._id });
      if (!teacher) return next();

      const scope = await buildTeacherScope(teacher._id);
      if (scope.classIds.length > 0) {
        req.studentClassIds = scope.classIds;
        req.teacherStreamIds = scope.streamIds;
        req.teacherScope = scope;
      }
      return next();
    } catch (error) {
      return next();
    }
  }

  return next();
};

const buildTeacherScope = async (teacherId) => {
  const [assignments, classTeacherClasses] = await Promise.all([
    TeacherAssignment.find({ teacher: teacherId }),
    Class.find({ classTeacher: teacherId }).distinct('_id'),
  ]);

  const classIds = [];
  const subjectIds = [];
  const streamIds = [];
  const classMap = {};

  for (const a of assignments) {
    if (!a.class) continue;
    const cid = a.class.toString();
    if (!classMap[cid]) classMap[cid] = { allStreams: false, streamIds: [], allSubjects: false, subjectIds: [] };
    if (a.stream) {
      const sid = a.stream.toString();
      if (!classMap[cid].streamIds.includes(sid)) classMap[cid].streamIds.push(sid);
    } else {
      classMap[cid].allStreams = true;
    }
    if (a.subject) {
      const subjId = a.subject.toString();
      if (!classMap[cid].subjectIds.includes(subjId)) classMap[cid].subjectIds.push(subjId);
      if (!subjectIds.includes(subjId)) subjectIds.push(subjId);
    } else {
      classMap[cid].allSubjects = true;
    }
    if (!classIds.includes(cid)) classIds.push(cid);
  }

  for (const cid of classTeacherClasses) {
    const cidStr = cid.toString();
    if (!classMap[cidStr]) classMap[cidStr] = { allStreams: true, streamIds: [], allSubjects: true, subjectIds: [] };
    else {
      classMap[cidStr].allStreams = true;
      classMap[cidStr].allSubjects = true;
    }
    if (!classIds.includes(cidStr)) classIds.push(cidStr);
  }

  for (const entry of Object.values(classMap)) {
    for (const sid of entry.streamIds) {
      if (!streamIds.includes(sid)) streamIds.push(sid);
    }
  }

  return { classIds, subjectIds, streamIds, classMap };
};

const authorizeStudentView = async (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Not authenticated' });
  if (req.user.role === 'headteacher') return next();

  if (['teacher', 'class_teacher', 'academic_teacher', 'subject_teacher'].includes(req.user.role)) {
    try {
      const teacher = await Teacher.findOne({ user: req.user._id });
      if (!teacher) return next();

      const studentId = req.params.id;
      if (!studentId) return next();

      const student = await Student.findById(studentId);
      if (!student) return next();
      if (!student.class) return next();

      const [classDoc, assignments] = await Promise.all([
        Class.findById(student.class).select('classTeacher'),
        TeacherAssignment.find({ teacher: teacher._id, class: student.class }),
      ]);

      const isClassTeacher = classDoc && classDoc.classTeacher && classDoc.classTeacher.toString() === teacher._id.toString();

      if (assignments.length === 0 && !isClassTeacher && req.user.role !== 'subject_teacher') {
        return res.status(403).json({ success: false, message: 'You are not assigned to this student\'s class' });
      }

      if (assignments.length > 0 && student.stream) {
        const hasStreamAccess = assignments.some(a => !a.stream || (a.stream.toString() === student.stream.toString()));
        if (!hasStreamAccess) {
          return res.status(403).json({ success: false, message: 'You are not assigned to this student\'s stream' });
        }
      }
      return next();
    } catch (error) {
      return next();
    }
  }

  return next();
};

const authorizeReportCardView = async (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Not authenticated' });

  const role = req.user.role;
  if (role === 'headteacher' || role === 'academic_teacher') return next();

  const targetId = req.params.id || req.params.studentId;
  if (!targetId) return next();

  if (role === 'student') {
    const student = await Student.findOne({ user: req.user._id });
    if (student && student._id.toString() === targetId.toString()) return next();
    return res.status(403).json({ success: false, message: 'You can only view your own report cards' });
  }

  if (['teacher', 'class_teacher', 'subject_teacher'].includes(role)) {
    try {
      const teacher = await Teacher.findOne({ user: req.user._id });
      if (!teacher) return res.status(404).json({ success: false, message: 'Teacher profile not found' });

      let classId = null;
      if (req.params.id) {
        const rc = await ReportCard.findById(req.params.id).select('class');
        if (rc) classId = rc.class;
      } else {
        const student = await Student.findById(targetId).select('class');
        if (student) classId = student.class;
      }
      if (!classId) return next();

      const scope = await buildTeacherScope(teacher._id);
      const hasClassAccess = scope.classIds.some((cid) => cid.toString() === classId.toString());
      if (hasClassAccess) return next();
      return res.status(403).json({ success: false, message: 'You are not assigned to this class' });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  return res.status(403).json({ success: false, message: 'Not authorized to view report cards' });
};

const scopeAttendanceByTeacher = async (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Not authenticated' });
  if (req.user.role === 'headteacher' || req.user.role === 'admin') return next();

  try {
    const teacher = await Teacher.findOne({ user: req.user._id });
    if (!teacher) {
      req.teacherClassIds = [];
      req.teacherSubjectIds = [];
      req.teacherStreamIds = [];
      req.teacherScope = { classIds: [], subjectIds: [], streamIds: [], classMap: {} };
      return next();
    }

    const scope = await buildTeacherScope(teacher._id);
    if (scope.classIds.length > 0) req.teacherClassIds = scope.classIds;
    if (scope.subjectIds.length > 0) req.teacherSubjectIds = scope.subjectIds;
    if (scope.streamIds.length > 0) req.teacherStreamIds = scope.streamIds;
    req.teacherScope = scope;
    req.teacherProfile = teacher;
    return next();
  } catch (error) {
    req.teacherClassIds = [];
    req.teacherSubjectIds = [];
    req.teacherStreamIds = [];
    req.teacherScope = { classIds: [], subjectIds: [], streamIds: [], classMap: {} };
    return next();
  }
};

module.exports = { authorize, authorizeAttendance, authorizeAssessmentCreation, authorizeSubjectAccess, authorizeStudentEdit, scopeStudentsByTeacher, authorizeStudentView, scopeAttendanceByTeacher, authorizeReportCardView };