const mongoose = require('mongoose');
const Teacher = require('../models/Teacher');
const TeacherAssignment = require('../models/TeacherAssignment');
const CurriculumTopic = require('../models/CurriculumTopic');
const CurriculumLesson = require('../models/CurriculumLesson');
const LessonResource = require('../models/LessonResource');
const LessonEvent = require('../models/LessonEvent');

const ASSIGNMENT_POPULATE = [
  { path: 'teacher', select: 'firstName lastName' },
  { path: 'class', select: 'name code' },
  { path: 'subject', select: 'name code' },
  { path: 'stream', select: 'name' },
  { path: 'academicYear', select: 'name year' },
  { path: 'term', select: 'name' },
];

const topicStatus = (lessons) => {
  if (!lessons || lessons.length === 0) return 'not_started';
  const completed = lessons.filter((l) => l.status === 'completed').length;
  if (completed === lessons.length) return 'completed';
  if (completed > 0) return 'in_progress';
  return 'not_started';
};

async function computeProgress(assignmentId) {
  const topics = await CurriculumTopic.find({ assignment: assignmentId, deletedAt: null })
    .sort({ order: 1, createdAt: 1 })
    .lean();
  const lessons = await CurriculumLesson.find({ assignment: assignmentId, deletedAt: null })
    .sort({ order: 1, createdAt: 1 })
    .lean();

  const lessonsByTopic = {};
  for (const l of lessons) {
    (lessonsByTopic[l.topic] = lessonsByTopic[l.topic] || []).push(l);
  }

  let totalTopics = 0;
  let completedTopics = 0;
  let totalLessons = 0;
  let completedLessons = 0;
  let lastUpdated = null;
  let currentTopic = null;
  let currentLesson = null;

  for (const t of topics) {
    const tLessons = lessonsByTopic[t._id.toString()] || [];
    const completed = tLessons.filter((l) => l.status === 'completed').length;
    totalTopics += 1;
    if (tLessons.length > 0 && completed === tLessons.length) completedTopics += 1;
    totalLessons += tLessons.length;
    completedLessons += completed;
    if (t.updatedAt && (!lastUpdated || t.updatedAt > lastUpdated)) lastUpdated = t.updatedAt;
    for (const l of tLessons) {
      if (l.updatedAt && (!lastUpdated || l.updatedAt > lastUpdated)) lastUpdated = l.updatedAt;
      if (!currentLesson && l.status !== 'completed') {
        currentTopic = { _id: t._id, title: t.title };
        currentLesson = { _id: l._id, title: l.title, topicId: t._id };
      }
    }
  }

  const overallPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
  return {
    totalTopics,
    completedTopics,
    totalLessons,
    completedLessons,
    overallPercent,
    lastUpdated,
    currentTopic,
    currentLesson,
  };
}

const teacherName = (t) => (t ? `${t.firstName || ''} ${t.lastName || ''}`.trim() : '');

exports.getTeacherByUser = (userId) => Teacher.findOne({ user: userId });

exports.listSubjects = async (req, res) => {
  try {
    const teacher = req.teacher;
    const assignments = await TeacherAssignment.find({ teacher: teacher._id, subject: { $exists: true } })
      .populate(ASSIGNMENT_POPULATE)
      .sort({ createdAt: -1 })
      .lean();

    const rows = [];
    for (const a of assignments) {
      if (!a.subject) continue;
      const stats = await computeProgress(a._id);
      rows.push({ ...a, teacherName: teacherName(a.teacher), stats });
    }
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getOverview = async (req, res) => {
  try {
    const stats = await computeProgress(req.assignment._id);
    res.json({
      success: true,
      data: { assignment: req.assignment, teacherName: teacherName(req.assignment.teacher), stats },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getTopics = async (req, res) => {
  try {
    const topics = await CurriculumTopic.find({ assignment: req.assignment._id, deletedAt: null })
      .sort({ order: 1, createdAt: 1 })
      .lean();
    const lessons = await CurriculumLesson.find({ assignment: req.assignment._id, deletedAt: null })
      .sort({ order: 1, createdAt: 1 })
      .lean();
    const resourceCounts = await LessonResource.aggregate([
      { $match: { assignment: req.assignment._id, deletedAt: null } },
      { $group: { _id: '$lesson', count: { $sum: 1 } } },
    ]);
    const counts = {};
    for (const r of resourceCounts) counts[r._id.toString()] = r.count;

    const lessonsByTopic = {};
    for (const l of lessons) {
      (lessonsByTopic[l.topic.toString()] = lessonsByTopic[l.topic.toString()] || []).push({
        ...l,
        resourceCount: counts[l._id.toString()] || 0,
      });
    }

    const rows = topics.map((t) => {
      const tLessons = lessonsByTopic[t._id.toString()] || [];
      return {
        ...t,
        status: topicStatus(tLessons),
        lessons: tLessons,
        completedLessons: tLessons.filter((l) => l.status === 'completed').length,
      };
    });
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createTopic = async (req, res) => {
  try {
    const { title, description, estimatedLessons, notes } = req.body || {};
    if (!title || !String(title).trim()) {
      return res.status(400).json({ success: false, message: 'Topic title cannot be empty.' });
    }
    const duplicate = await CurriculumTopic.findOne({
      assignment: req.assignment._id,
      title: String(title).trim(),
      deletedAt: null,
    });
    if (duplicate) {
      return res.status(400).json({ success: false, message: 'A topic with this title already exists.' });
    }
    const maxOrder = await CurriculumTopic.findOne({ assignment: req.assignment._id, deletedAt: null })
      .sort({ order: -1 })
      .select('order');
    const topic = await CurriculumTopic.create({
      assignment: req.assignment._id,
      title: String(title).trim(),
      description: description || '',
      estimatedLessons: estimatedLessons || undefined,
      notes: notes || '',
      order: (maxOrder?.order || 0) + 1,
    });
    res.status(201).json({ success: true, data: topic });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateTopic = async (req, res) => {
  try {
    const { title, description, estimatedLessons, notes } = req.body || {};
    if (title !== undefined && !String(title).trim()) {
      return res.status(400).json({ success: false, message: 'Topic title cannot be empty.' });
    }
    if (title !== undefined) {
      const duplicate = await CurriculumTopic.findOne({
        assignment: req.topic.assignment,
        title: String(title).trim(),
        deletedAt: null,
        _id: { $ne: req.topic._id },
      });
      if (duplicate) {
        return res.status(400).json({ success: false, message: 'A topic with this title already exists.' });
      }
    }
    if (title !== undefined) req.topic.title = String(title).trim();
    if (description !== undefined) req.topic.description = description;
    if (estimatedLessons !== undefined) req.topic.estimatedLessons = estimatedLessons;
    if (notes !== undefined) req.topic.notes = notes;
    await req.topic.save();
    res.json({ success: true, data: req.topic });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteTopic = async (req, res) => {
  try {
    const now = new Date();
    const lessons = await CurriculumLesson.find({ topic: req.topic._id, deletedAt: null }).select('_id');
    const lessonIds = lessons.map((l) => l._id);
    req.topic.deletedAt = now;
    await req.topic.save();
    if (lessonIds.length > 0) {
      await CurriculumLesson.updateMany({ _id: { $in: lessonIds } }, { $set: { deletedAt: now } });
      await LessonResource.updateMany({ lesson: { $in: lessonIds } }, { $set: { deletedAt: now } });
    }
    res.json({ success: true, message: `Topic "${req.topic.title}" deleted with its lessons.` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.reorderTopics = async (req, res) => {
  try {
    const { ids } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid topic order.' });
    }
    const topics = await CurriculumTopic.find({
      _id: { $in: ids },
      assignment: req.assignment._id,
      deletedAt: null,
    });
    if (topics.length !== ids.length) {
      return res.status(400).json({ success: false, message: 'Invalid topic list.' });
    }
    for (let i = 0; i < ids.length; i += 1) {
      await CurriculumTopic.updateOne({ _id: ids[i] }, { $set: { order: -(i + 1) } });
    }
    for (let i = 0; i < ids.length; i += 1) {
      await CurriculumTopic.updateOne({ _id: ids[i] }, { $set: { order: i + 1 } });
    }
    res.json({ success: true, message: 'Topics reordered.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createLesson = async (req, res) => {
  try {
    const { title, order, duration, objectives, outline, notes, homework, assessmentNotes } = req.body || {};
    if (!title || !String(title).trim()) {
      return res.status(400).json({ success: false, message: 'Lesson title cannot be empty.' });
    }
    const duplicate = await CurriculumLesson.findOne({
      assignment: req.assignment._id,
      topic: req.topic._id,
      title: String(title).trim(),
      deletedAt: null,
    });
    if (duplicate) {
      return res.status(400).json({ success: false, message: 'A lesson with this title already exists in this topic.' });
    }
    const maxOrder = await CurriculumLesson.findOne({ topic: req.topic._id, deletedAt: null })
      .sort({ order: -1 })
      .select('order');
    const lesson = await CurriculumLesson.create({
      assignment: req.assignment._id,
      topic: req.topic._id,
      title: String(title).trim(),
      order: order || (maxOrder?.order || 0) + 1,
      duration: duration || undefined,
      objectives: Array.isArray(objectives) ? objectives.filter((o) => o && String(o).trim()) : [],
      outline: Array.isArray(outline) ? outline.filter((o) => o && String(o).trim()) : [],
      notes: notes || '',
      homework: homework || '',
      assessmentNotes: assessmentNotes || '',
    });
    res.status(201).json({ success: true, data: lesson });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateLesson = async (req, res) => {
  try {
    const { title, order, duration, objectives, outline, notes, homework, assessmentNotes } = req.body || {};
    if (title !== undefined && !String(title).trim()) {
      return res.status(400).json({ success: false, message: 'Lesson title cannot be empty.' });
    }
    if (title !== undefined) {
      const duplicate = await CurriculumLesson.findOne({
        assignment: req.lesson.assignment,
        topic: req.lesson.topic,
        title: String(title).trim(),
        deletedAt: null,
        _id: { $ne: req.lesson._id },
      });
      if (duplicate) {
        return res.status(400).json({ success: false, message: 'A lesson with this title already exists in this topic.' });
      }
    }
    if (title !== undefined) req.lesson.title = String(title).trim();
    if (order !== undefined) req.lesson.order = order;
    if (duration !== undefined) req.lesson.duration = duration;
    if (objectives !== undefined) req.lesson.objectives = Array.isArray(objectives) ? objectives.filter((o) => o && String(o).trim()) : [];
    if (outline !== undefined) req.lesson.outline = Array.isArray(outline) ? outline.filter((o) => o && String(o).trim()) : [];
    if (notes !== undefined) req.lesson.notes = notes;
    if (homework !== undefined) req.lesson.homework = homework;
    if (assessmentNotes !== undefined) req.lesson.assessmentNotes = assessmentNotes;
    await req.lesson.save();
    res.json({ success: true, data: req.lesson });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteLesson = async (req, res) => {
  try {
    const now = new Date();
    req.lesson.deletedAt = now;
    await req.lesson.save();
    await LessonResource.updateMany({ lesson: req.lesson._id }, { $set: { deletedAt: now } });
    res.json({ success: true, message: `Lesson "${req.lesson.title}" deleted.` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.reorderLessons = async (req, res) => {
  try {
    const { ids } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid lesson order.' });
    }
    const lessons = await CurriculumLesson.find({
      _id: { $in: ids },
      assignment: req.assignment._id,
      topic: req.topic._id,
      deletedAt: null,
    });
    if (lessons.length !== ids.length) {
      return res.status(400).json({ success: false, message: 'Invalid lesson list.' });
    }
    for (let i = 0; i < ids.length; i += 1) {
      await CurriculumLesson.updateOne({ _id: ids[i] }, { $set: { order: -(i + 1) } });
    }
    for (let i = 0; i < ids.length; i += 1) {
      await CurriculumLesson.updateOne({ _id: ids[i] }, { $set: { order: i + 1 } });
    }
    res.json({ success: true, message: 'Lessons reordered.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.markCompleted = async (req, res) => {
  try {
    if (req.lesson.status === 'completed') {
      return res.status(400).json({ success: false, message: 'Lesson is already marked as completed.' });
    }
    const now = new Date();
    req.lesson.status = 'completed';
    req.lesson.completedAt = now;
    req.lesson.completedBy = req.user._id;
    await req.lesson.save();
    await LessonEvent.create({ lesson: req.lesson._id, assignment: req.lesson.assignment, action: 'completed', by: req.user._id });
    res.json({ success: true, message: 'Lesson successfully marked as completed.', data: req.lesson });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.reopenLesson = async (req, res) => {
  try {
    if (req.lesson.status !== 'completed') {
      return res.status(400).json({ success: false, message: 'Only completed lessons can be reopened.' });
    }
    req.lesson.status = 'not_started';
    req.lesson.completedAt = null;
    req.lesson.completedBy = null;
    req.lesson.reopenedAt = new Date();
    await req.lesson.save();
    await LessonEvent.create({ lesson: req.lesson._id, assignment: req.lesson.assignment, action: 'reopened', by: req.user._id });
    res.json({ success: true, message: 'Lesson reopened.', data: req.lesson });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getLessonDetail = async (req, res) => {
  try {
    const [events, resources] = await Promise.all([
      LessonEvent.find({ lesson: req.lesson._id }).sort({ at: 1 }).lean(),
      LessonResource.find({ lesson: req.lesson._id, deletedAt: null }).sort({ createdAt: 1 }).lean(),
    ]);
    res.json({ success: true, data: { lesson: req.lesson, events, resources } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.addResource = async (req, res) => {
  try {
    const { title, description, type, url } = req.body || {};
    if (!title || !String(title).trim()) {
      return res.status(400).json({ success: false, message: 'Resource title cannot be empty.' });
    }
    if (!url || !String(url).trim()) {
      return res.status(400).json({ success: false, message: 'Resource URL cannot be empty.' });
    }
    const resource = await LessonResource.create({
      lesson: req.lesson._id,
      assignment: req.lesson.assignment,
      title: String(title).trim(),
      description: description || '',
      type: type || 'other',
      url: String(url).trim(),
    });
    res.status(201).json({ success: true, data: resource });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateResource = async (req, res) => {
  try {
    const { title, description, type, url } = req.body || {};
    if (title !== undefined) {
      if (!String(title).trim()) return res.status(400).json({ success: false, message: 'Resource title cannot be empty.' });
      req.resource.title = String(title).trim();
    }
    if (url !== undefined) {
      if (!String(url).trim()) return res.status(400).json({ success: false, message: 'Resource URL cannot be empty.' });
      req.resource.url = String(url).trim();
    }
    if (description !== undefined) req.resource.description = description;
    if (type !== undefined) req.resource.type = type;
    await req.resource.save();
    res.json({ success: true, data: req.resource });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteResource = async (req, res) => {
  try {
    req.resource.deletedAt = new Date();
    await req.resource.save();
    res.json({ success: true, message: 'Resource removed.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getReport = async (req, res) => {
  try {
    const isHeadteacher = req.user.role === 'headteacher';
    const query = isHeadteacher ? { subject: { $exists: true } } : { teacher: req.teacher._id, subject: { $exists: true } };
    const assignments = await TeacherAssignment.find(query)
      .populate(ASSIGNMENT_POPULATE)
      .sort({ createdAt: -1 })
      .limit(200);

    const rows = [];
    for (const a of assignments) {
      if (!a.subject) continue;
      const stats = await computeProgress(a._id);
      rows.push({
        assignmentId: a._id,
        teacherName: teacherName(a.teacher),
        subjectName: a.subject?.name,
        className: a.class?.name,
        streamName: a.stream?.name || 'All',
        yearName: a.academicYear?.name,
        termName: a.term?.name,
        topicsCompleted: stats.completedTopics,
        totalTopics: stats.totalTopics,
        lessonsCompleted: stats.completedLessons,
        totalLessons: stats.totalLessons,
        overallPercent: stats.overallPercent,
        currentTopic: stats.currentTopic?.title || null,
        currentLesson: stats.currentLesson?.title || null,
        lastActivity: stats.lastUpdated,
        status: stats.totalLessons === 0 ? 'Not Started' : stats.overallPercent === 100 ? 'Completed' : 'In Progress',
      });
    }
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
