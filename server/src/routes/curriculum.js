const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { auditLogger } = require('../middleware/audit');
const { loadAssignment, loadTopic, loadLesson, loadResource } = require('../middleware/curriculumAuth');
const curriculum = require('../controllers/curriculumController');

const TEACHER_ROLES = ['teacher', 'subject_teacher', 'class_teacher', 'academic_teacher'];

const resolveTeacher = async (req, res, next) => {
  try {
    const teacher = await curriculum.getTeacherByUser(req.user._id);
    if (!teacher && !TEACHER_ROLES.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'You are not authorized to access this teaching assignment.' });
    }
    req.teacher = teacher || null;
    next();
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

router.get('/subjects', protect, resolveTeacher, curriculum.listSubjects);
router.get('/report', protect, resolveTeacher, curriculum.getReport);

router.get('/assignments/:assignmentId', protect, resolveTeacher, loadAssignment, curriculum.getOverview);
router.get('/assignments/:assignmentId/topics', protect, resolveTeacher, loadAssignment, curriculum.getTopics);
router.post('/assignments/:assignmentId/topics', protect, resolveTeacher, loadAssignment, auditLogger, curriculum.createTopic);
router.post('/assignments/:assignmentId/topics/reorder', protect, resolveTeacher, loadAssignment, auditLogger, curriculum.reorderTopics);
router.post('/assignments/:assignmentId/topics/:topicId/lessons', protect, resolveTeacher, loadTopic, auditLogger, curriculum.createLesson);
router.post('/assignments/:assignmentId/topics/:topicId/lessons/reorder', protect, resolveTeacher, loadTopic, auditLogger, curriculum.reorderLessons);
router.post('/lessons/:lessonId/resources', protect, resolveTeacher, loadLesson, auditLogger, curriculum.addResource);

router.put('/topics/:topicId', protect, resolveTeacher, loadTopic, auditLogger, curriculum.updateTopic);
router.delete('/topics/:topicId', protect, resolveTeacher, loadTopic, auditLogger, curriculum.deleteTopic);

router.put('/lessons/:lessonId', protect, resolveTeacher, loadLesson, auditLogger, curriculum.updateLesson);
router.delete('/lessons/:lessonId', protect, resolveTeacher, loadLesson, auditLogger, curriculum.deleteLesson);
router.get('/lessons/:lessonId', protect, resolveTeacher, loadLesson, curriculum.getLessonDetail);
router.post('/lessons/:lessonId/complete', protect, resolveTeacher, loadLesson, auditLogger, curriculum.markCompleted);
router.post('/lessons/:lessonId/reopen', protect, resolveTeacher, loadLesson, auditLogger, curriculum.reopenLesson);

router.put('/resources/:resourceId', protect, resolveTeacher, loadResource, auditLogger, curriculum.updateResource);
router.delete('/resources/:resourceId', protect, resolveTeacher, loadResource, auditLogger, curriculum.deleteResource);

module.exports = router;
