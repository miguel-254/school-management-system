const express = require('express');
const router = express.Router();
const {
  getClasses,
  getClass,
  createClass,
  updateClass,
  deleteClass,
  assignTeacher,
  assignSubject,
  getClassStudents,
  getClassSubjects,
  getClassStreams,
  assignStreamTeacher,
  removeStreamTeacher,
  getStreamAssignments
} = require('../controllers/classController');
const { protect } = require('../middleware/auth');
const { authorize, scopeAttendanceByTeacher } = require('../middleware/rbac');
const { auditLogger } = require('../middleware/audit');

router.get('/', protect, getClasses);
router.get('/:id', protect, getClass);
router.post('/', protect, authorize('headteacher'), auditLogger, createClass);
router.put('/:id', protect, authorize('headteacher'), auditLogger, updateClass);
router.delete('/:id', protect, authorize('headteacher'), auditLogger, deleteClass);
router.post('/:id/assign-teacher', protect, authorize('headteacher'), auditLogger, assignTeacher);
router.post('/:id/assign-subject', protect, authorize('headteacher'), auditLogger, assignSubject);
router.get('/:id/students', protect, scopeAttendanceByTeacher, getClassStudents);
router.get('/:id/subjects', protect, getClassSubjects);
router.get('/:id/streams', protect, getClassStreams);
router.post('/:id/streams/:streamId/assign-teacher', protect, authorize('headteacher'), auditLogger, assignStreamTeacher);
router.delete('/:id/streams/:streamId/assign-teacher', protect, authorize('headteacher'), auditLogger, removeStreamTeacher);
router.get('/:id/stream-assignments', protect, getStreamAssignments);

module.exports = router;
