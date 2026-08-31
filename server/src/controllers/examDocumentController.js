const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const ExamDocument = require('../models/ExamDocument');
const Class = require('../models/Class');
const Subject = require('../models/Subject');
const Teacher = require('../models/Teacher');
const TeacherAssignment = require('../models/TeacherAssignment');
const AuditLog = require('../models/AuditLog');
const { sendNotificationToMany } = require('../utils/notificationService');

const DOC_DIR = path.join(__dirname, '..', '..', 'private', 'exam-docs');

const refId = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value instanceof mongoose.Types.ObjectId) return value.toString();
  if (value._id) return value._id.toString();
  return value.toString ? value.toString() : null;
};

const findTargetTeacherUserIds = async ({ classId, subjectId, streamId, excludeUser }) => {
  const classDoc = await Class.findById(classId).select('classTeacher');
  const teacherIds = new Set();
  if (classDoc?.classTeacher) teacherIds.add(classDoc.classTeacher.toString());

  const [classTeacherAssignments, subjectTeacherAssignments] = await Promise.all([
    TeacherAssignment.find({ class: classId, isClassTeacher: true }).select('teacher'),
    TeacherAssignment.find({
      class: classId,
      subject: subjectId,
      ...(streamId ? { $or: [{ stream: streamId }, { stream: { $exists: false } }, { stream: null }] } : {}),
    }).select('teacher'),
  ]);

  for (const a of classTeacherAssignments) teacherIds.add(a.teacher.toString());
  for (const a of subjectTeacherAssignments) teacherIds.add(a.teacher.toString());

  if (teacherIds.size === 0) return [];

  const teachers = await Teacher.find({ _id: { $in: [...teacherIds] } }).select('user');
  const exclude = excludeUser ? excludeUser.toString() : null;
  return [...new Set(
    teachers.map((t) => t.user?.toString()).filter(Boolean).filter((id) => id !== exclude)
  )];
};

const canAccessDocument = async (user, doc) => {
  if (['headteacher', 'admin', 'academic_teacher'].includes(user.role)) return true;
  if (!['teacher', 'class_teacher', 'subject_teacher'].includes(user.role)) return false;

  const teacher = await Teacher.findOne({ user: user._id });
  if (!teacher) return false;

  const [assignments, classTeacherClasses] = await Promise.all([
    TeacherAssignment.find({ teacher: teacher._id }).select('class subject stream'),
    Class.find({ classTeacher: teacher._id }).select('_id subjects'),
  ]);

  const classMap = new Map();
  for (const a of assignments) {
    if (!a.class) continue;
    const cid = a.class.toString();
    if (!classMap.has(cid)) classMap.set(cid, { allSubjects: false, subjects: new Set(), streams: new Set() });
    const entry = classMap.get(cid);
    if (a.subject) entry.subjects.add(a.subject.toString());
    else entry.allSubjects = true;
    if (a.stream) entry.streams.add(a.stream.toString());
  }

  for (const c of classTeacherClasses) {
    const cid = c._id.toString();
    if (!classMap.has(cid)) classMap.set(cid, { allSubjects: false, subjects: new Set(), streams: new Set() });
    const entry = classMap.get(cid);
    entry.allSubjects = true;
    (c.subjects || []).forEach((s) => s && entry.subjects.add(s.toString()));
  }

  const entry = classMap.get(refId(doc.class));
  if (!entry) return false;
  if (!entry.allSubjects && !entry.subjects.has(refId(doc.subject))) return false;
  if (doc.stream) {
    const streamId = refId(doc.stream);
    if (streamId && entry.streams.size > 0 && !entry.streams.has(streamId)) return false;
  }
  return true;
};

exports.uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload a Word or PDF document' });
    }

    const { class: classId, subject: subjectId, stream, term, title } = req.body;

    if (!classId || !subjectId) {
      return res.status(400).json({ success: false, message: 'Target class and subject are required' });
    }

    const [classDoc, subjectDoc] = await Promise.all([
      Class.findById(classId).select('name'),
      Subject.findById(subjectId).select('name'),
    ]);
    if (!classDoc) return res.status(400).json({ success: false, message: 'Class not found' });
    if (!subjectDoc) return res.status(400).json({ success: false, message: 'Subject not found' });

    const ext = (req.file.originalname || '').split('.').pop().toLowerCase();
    if (!['doc', 'docx', 'pdf'].includes(ext)) {
      return res.status(400).json({ success: false, message: 'Only Word (.doc/.docx) and PDF documents are supported' });
    }

    if (!fs.existsSync(DOC_DIR)) fs.mkdirSync(DOC_DIR, { recursive: true });

    const base = path.basename(req.file.originalname, path.extname(req.file.originalname))
      .replace(/[^a-zA-Z0-9-_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 60);
    const filename = `exam_${Date.now()}_${base || 'document'}${ext}`;
    fs.writeFileSync(path.join(DOC_DIR, filename), req.file.buffer);

    const doc = await ExamDocument.create({
      title: (title || req.file.originalname).trim(),
      filename,
      originalName: req.file.originalname,
      size: req.file.size,
      mimeType: req.file.mimetype,
      class: classId,
      subject: subjectId,
      stream: stream || undefined,
      term: term || undefined,
      uploadedBy: req.user._id,
    });

    await AuditLog.create({
      user: req.user._id,
      action: 'UPLOAD_EXAM_DOCUMENT',
      resource: 'ExamDocument',
      resourceId: doc._id,
      details: { filename, originalName: req.file.originalname, classId, subjectId, size: req.file.size },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    const populated = await ExamDocument.findById(doc._id)
      .populate('class', 'name')
      .populate('subject', 'name')
      .populate('stream', 'name')
      .populate('term', 'name')
      .populate('uploadedBy', 'firstName lastName');

    const recipients = await findTargetTeacherUserIds({
      classId,
      subjectId,
      streamId: stream,
      excludeUser: req.user._id,
    });

    if (recipients.length > 0) {
      const target = `${populated.class?.name || ''} \u00b7 ${populated.subject?.name || ''}${populated.stream?.name ? ` \u00b7 ${populated.stream.name}` : ''}`.trim();
      await sendNotificationToMany({
        recipients,
        type: 'exam',
        title: 'New assessment document uploaded',
        message: `"${populated.title}" has been uploaded for ${target}`,
        link: '/assessments',
        sentBy: req.user._id,
      });
    }

    res.status(201).json({
      success: true,
      data: populated,
      message: 'Exam document uploaded successfully',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.listDocuments = async (req, res) => {
  try {
    const docs = await ExamDocument.find()
      .sort({ createdAt: -1 })
      .populate('class', 'name')
      .populate('subject', 'name')
      .populate('stream', 'name')
      .populate('term', 'name')
      .populate('uploadedBy', 'firstName lastName');

    const accessible = [];
    for (const doc of docs) {
      if (await canAccessDocument(req.user, doc)) accessible.push(doc);
    }

    res.json({ success: true, data: accessible });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.downloadDocument = async (req, res) => {
  try {
    const doc = await ExamDocument.findById(req.params.id);
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    const allowed = await canAccessDocument(req.user, doc);
    if (!allowed) {
      return res.status(403).json({ success: false, message: 'You are not assigned to this document\'s class and subject' });
    }

    const filePath = path.join(DOC_DIR, doc.filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'Document file is missing on the server' });
    }

    await AuditLog.create({
      user: req.user._id,
      action: 'DOWNLOAD_EXAM_DOCUMENT',
      resource: 'ExamDocument',
      resourceId: doc._id,
      details: { title: doc.title, filename: doc.filename },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.download(filePath, doc.originalName);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteDocument = async (req, res) => {
  try {
    const doc = await ExamDocument.findById(req.params.id);
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    if (!['headteacher', 'admin', 'academic_teacher'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Only academic teachers and headteachers can delete documents' });
    }

    const filePath = path.join(DOC_DIR, doc.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    await ExamDocument.findByIdAndDelete(doc._id);

    await AuditLog.create({
      user: req.user._id,
      action: 'DELETE_EXAM_DOCUMENT',
      resource: 'ExamDocument',
      resourceId: doc._id,
      details: { title: doc.title, filename: doc.filename },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({ success: true, data: {}, message: 'Document deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
