const express = require('express');
const router = express.Router();
const {
  getHeadteacherDashboard,
  getClassTeacherDashboard,
  getSubjectTeacherDashboard,
  getAcademicTeacherDashboard,
} = require('../controllers/dashboardController');
const { protect } = require('../middleware/auth');
const { authorize, scopeAttendanceByTeacher } = require('../middleware/rbac');

router.get('/headteacher', protect, authorize('headteacher'), getHeadteacherDashboard);
router.get('/class-teacher', protect, scopeAttendanceByTeacher, authorize('class_teacher', 'headteacher'), getClassTeacherDashboard);
router.get('/subject-teacher', protect, scopeAttendanceByTeacher, authorize('subject_teacher', 'class_teacher', 'teacher', 'headteacher'), getSubjectTeacherDashboard);
router.get('/academic-teacher', protect, authorize('academic_teacher', 'headteacher'), getAcademicTeacherDashboard);

module.exports = router;