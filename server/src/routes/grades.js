const express = require('express');
const router = express.Router();
const {
  getGradeScales,
  createGradeScale,
  updateGradeScale,
  deleteGradeScale,
  calculateGrades,
  getGradeReport,
  getStudentGrades
} = require('../controllers/gradeController');
const { protect } = require('../middleware/auth');
const { authorize, scopeAttendanceByTeacher, authorizeStudentView } = require('../middleware/rbac');
const { auditLogger } = require('../middleware/audit');

router.get('/scales', protect, getGradeScales);
router.post('/scales', protect, authorize('headteacher'), auditLogger, createGradeScale);
router.put('/scales/:id', protect, authorize('headteacher'), auditLogger, updateGradeScale);
router.delete('/scales/:id', protect, authorize('headteacher'), auditLogger, deleteGradeScale);
router.post('/calculate', protect, scopeAttendanceByTeacher, auditLogger, calculateGrades);
router.get('/report', protect, scopeAttendanceByTeacher, getGradeReport);
router.get('/student/:studentId', protect, scopeAttendanceByTeacher, authorizeStudentView, getStudentGrades);

module.exports = router;
