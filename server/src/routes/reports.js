const express = require('express');
const router = express.Router();
const {
  getAttendanceReport,
  getPerformanceReport,
  getGradeAnalysisReport,
  getRankingReport,
  getSubjectPerformanceReport,
  getClassPerformanceReport,
  exportReport
} = require('../controllers/reportController');
const { protect } = require('../middleware/auth');
const { scopeAttendanceByTeacher } = require('../middleware/rbac');
const { auditLogger } = require('../middleware/audit');

function exportWithType(type) {
  return (req, res, next) => {
    req.query.type = type;
    return exportReport(req, res, next);
  };
}

router.get('/attendance', protect, scopeAttendanceByTeacher, getAttendanceReport);
router.get('/attendance/export', protect, scopeAttendanceByTeacher, auditLogger, exportWithType('attendance'));
router.get('/performance', protect, scopeAttendanceByTeacher, getPerformanceReport);
router.get('/performance/export', protect, scopeAttendanceByTeacher, auditLogger, exportWithType('performance'));
router.get('/grade-analysis', protect, scopeAttendanceByTeacher, getGradeAnalysisReport);
router.get('/ranking', protect, scopeAttendanceByTeacher, getRankingReport);
router.get('/subject-performance', protect, scopeAttendanceByTeacher, getSubjectPerformanceReport);
router.get('/class-performance', protect, scopeAttendanceByTeacher, getClassPerformanceReport);
router.get('/export', protect, scopeAttendanceByTeacher, auditLogger, exportReport);

module.exports = router;
