const express = require('express');
const router = express.Router();
const {
  getTeachers,
  getTeacher,
  createTeacher,
  updateTeacher,
  deleteTeacher,
  getTeacherAssignments,
  getTeacherDashboard
} = require('../controllers/teacherController');
const { protect } = require('../middleware/auth');
const { authorize, scopeAttendanceByTeacher } = require('../middleware/rbac');
const { auditLogger } = require('../middleware/audit');

router.get('/dashboard/stats', protect, scopeAttendanceByTeacher, authorize('teacher'), getTeacherDashboard);
router.get('/', protect, authorize('headteacher'), getTeachers);
router.get('/:id', protect, authorize('headteacher'), getTeacher);
router.post('/', protect, authorize('headteacher'), auditLogger, createTeacher);
router.put('/:id', protect, authorize('headteacher'), auditLogger, updateTeacher);
router.delete('/:id', protect, authorize('headteacher'), auditLogger, deleteTeacher);
router.get('/:id/assignments', protect, authorize('headteacher'), getTeacherAssignments);

module.exports = router;
