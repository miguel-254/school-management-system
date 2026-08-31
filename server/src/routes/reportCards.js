const express = require('express');
const router = express.Router();
const ReportCard = require('../models/ReportCard');
const AuditLog = require('../models/AuditLog');
const {
  getReportCards,
  generateReportCard,
  bulkGenerateReportCards,
  getReportCard,
  publishReportCards,
  getStudentReportCards,
  printReportCard,
  exportReportCards
} = require('../controllers/reportCardController');
const { protect } = require('../middleware/auth');
const { authorize, scopeAttendanceByTeacher, authorizeReportCardView } = require('../middleware/rbac');
const { auditLogger } = require('../middleware/audit');

router.get('/', protect, scopeAttendanceByTeacher, getReportCards);
router.post('/generate', protect, scopeAttendanceByTeacher, auditLogger, generateReportCard);
router.post('/generate/:studentId', protect, scopeAttendanceByTeacher, auditLogger, generateReportCard);
router.post('/bulk-generate', protect, authorize('headteacher'), auditLogger, bulkGenerateReportCards);
router.post('/bulk-generate/:classId', protect, authorize('headteacher'), auditLogger, bulkGenerateReportCards);
router.put('/publish-all', protect, authorize('headteacher'), auditLogger, async (req, res, next) => {
  try {
    const result = await ReportCard.updateMany(
      { isPublished: { $ne: true } },
      { $set: { isPublished: true } }
    );
    await AuditLog.create({
      user: req.user._id, action: 'PUBLISH_ALL_REPORT_CARDS', resource: 'ReportCard',
      details: { modifiedCount: result.modifiedCount }, ipAddress: req.ip, userAgent: req.get('User-Agent'),
    });
    res.json({ success: true, data: { modifiedCount: result.modifiedCount }, message: `${result.modifiedCount} report cards published` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
router.get('/student/:studentId', protect, scopeAttendanceByTeacher, authorizeReportCardView, getStudentReportCards);
router.get('/:id', protect, scopeAttendanceByTeacher, authorizeReportCardView, getReportCard);
router.put('/:id', protect, authorize('headteacher'), auditLogger, async (req, res) => {
  try {
    const { isPublished, teacherRemarks, headteacherRemarks } = req.body;
    const update = {};
    if (isPublished !== undefined) update.isPublished = isPublished;
    if (teacherRemarks !== undefined) update.teacherRemarks = teacherRemarks;
    if (headteacherRemarks !== undefined) update.headteacherRemarks = headteacherRemarks;

    const reportCard = await ReportCard.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!reportCard) return res.status(404).json({ success: false, message: 'Report card not found' });

    await AuditLog.create({
      user: req.user._id, action: 'UPDATE_REPORT_CARD', resource: 'ReportCard',
      resourceId: reportCard._id, details: update, ipAddress: req.ip, userAgent: req.get('User-Agent'),
    });

    res.json({ success: true, data: reportCard, message: 'Report card updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
router.delete('/:id', protect, authorize('headteacher'), auditLogger, async (req, res) => {
  try {
    const reportCard = await ReportCard.findByIdAndDelete(req.params.id);
    if (!reportCard) return res.status(404).json({ success: false, message: 'Report card not found' });

    await AuditLog.create({
      user: req.user._id, action: 'DELETE_REPORT_CARD', resource: 'ReportCard',
      resourceId: req.params.id, ipAddress: req.ip, userAgent: req.get('User-Agent'),
    });

    res.json({ success: true, data: {}, message: 'Report card deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
router.put('/:id/publish', protect, authorize('headteacher'), auditLogger, async (req, res) => {
  try {
    const reportCard = await ReportCard.findByIdAndUpdate(
      req.params.id, { isPublished: true }, { new: true }
    );
    if (!reportCard) return res.status(404).json({ success: false, message: 'Report card not found' });

    await AuditLog.create({
      user: req.user._id, action: 'PUBLISH_REPORT_CARD', resource: 'ReportCard',
      resourceId: reportCard._id, ipAddress: req.ip, userAgent: req.get('User-Agent'),
    });

    res.json({ success: true, data: reportCard, message: 'Report card published' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
router.get('/:id/print', protect, scopeAttendanceByTeacher, authorizeReportCardView, printReportCard);
router.get('/:id/export', protect, scopeAttendanceByTeacher, exportReportCards);

module.exports = router;
