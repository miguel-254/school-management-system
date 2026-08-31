const express = require('express');
const router = express.Router();
const {
  getAttendance,
  markAttendance,
  bulkMarkAttendance,
  updateAttendance,
  getAttendanceReport,
  getStudentAttendance,
  getClassAttendance,
  getAttendanceAnalytics
} = require('../controllers/attendanceController');
const { protect } = require('../middleware/auth');
const { authorize, authorizeAttendance, scopeAttendanceByTeacher } = require('../middleware/rbac');
const { auditLogger } = require('../middleware/audit');

router.get('/report', protect, scopeAttendanceByTeacher, getAttendanceReport);
router.get('/analytics', protect, authorize('headteacher'), getAttendanceAnalytics);
router.get('/', protect, scopeAttendanceByTeacher, getAttendance);
router.post('/', protect, scopeAttendanceByTeacher, authorizeAttendance, auditLogger, markAttendance);
router.post('/bulk', protect, scopeAttendanceByTeacher, authorizeAttendance, auditLogger, bulkMarkAttendance);
router.put('/:id', protect, scopeAttendanceByTeacher, authorizeAttendance, auditLogger, updateAttendance);
router.get('/student/:studentId', protect, scopeAttendanceByTeacher, getStudentAttendance);
router.get('/class/:classId', protect, scopeAttendanceByTeacher, getClassAttendance);

module.exports = router;