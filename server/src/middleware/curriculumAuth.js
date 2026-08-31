const TeacherAssignment = require('../models/TeacherAssignment');
const CurriculumTopic = require('../models/CurriculumTopic');
const CurriculumLesson = require('../models/CurriculumLesson');
const LessonResource = require('../models/LessonResource');

const FORBIDDEN = 'You are not authorized to access this teaching assignment.';

const ASSIGNMENT_POPULATE = [
  { path: 'teacher', select: 'firstName lastName' },
  { path: 'class', select: 'name code' },
  { path: 'subject', select: 'name code' },
  { path: 'stream', select: 'name' },
  { path: 'academicYear', select: 'name year' },
  { path: 'term', select: 'name' },
];

const loadAssignment = async (req, res, next) => {
  try {
    const teacher = req.teacher;
    const assignment = await TeacherAssignment.findById(req.params.assignmentId)
      .populate(ASSIGNMENT_POPULATE)
      .lean();
    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Teaching assignment not found.' });
    }
    if (!teacher || !assignment.teacher || teacher._id.toString() !== assignment.teacher._id.toString()) {
      return res.status(403).json({ success: false, message: FORBIDDEN });
    }
    req.assignment = assignment;
    next();
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const loadTopic = async (req, res, next) => {
  try {
    const topic = await CurriculumTopic.findOne({ _id: req.params.topicId, deletedAt: null });
    if (!topic) {
      return res.status(404).json({ success: false, message: 'Topic not found.' });
    }
    const assignment = await TeacherAssignment.findById(topic.assignment)
      .populate(ASSIGNMENT_POPULATE)
      .lean();
    if (!assignment || !req.teacher || assignment.teacher._id.toString() !== req.teacher._id.toString()) {
      return res.status(403).json({ success: false, message: FORBIDDEN });
    }
    req.topic = topic;
    req.assignment = assignment;
    next();
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const loadLesson = async (req, res, next) => {
  try {
    const lesson = await CurriculumLesson.findOne({ _id: req.params.lessonId, deletedAt: null });
    if (!lesson) {
      return res.status(404).json({ success: false, message: 'Lesson not found.' });
    }
    const assignment = await TeacherAssignment.findById(lesson.assignment)
      .populate(ASSIGNMENT_POPULATE)
      .lean();
    if (!assignment || !req.teacher || assignment.teacher._id.toString() !== req.teacher._id.toString()) {
      return res.status(403).json({ success: false, message: FORBIDDEN });
    }
    req.lesson = lesson;
    req.assignment = assignment;
    next();
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const loadResource = async (req, res, next) => {
  try {
    const resource = await LessonResource.findOne({ _id: req.params.resourceId, deletedAt: null });
    if (!resource) {
      return res.status(404).json({ success: false, message: 'Resource not found.' });
    }
    const assignment = await TeacherAssignment.findById(resource.assignment)
      .populate(ASSIGNMENT_POPULATE)
      .lean();
    if (!assignment || !req.teacher || assignment.teacher._id.toString() !== req.teacher._id.toString()) {
      return res.status(403).json({ success: false, message: FORBIDDEN });
    }
    req.resource = resource;
    req.assignment = assignment;
    next();
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { loadAssignment, loadTopic, loadLesson, loadResource, FORBIDDEN };
