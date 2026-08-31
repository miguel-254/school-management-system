const express = require('express');
const router = express.Router();
const multer = require('multer');
const {
  getAssessments,
  getAssessment,
  createAssessment,
  updateAssessment,
  deleteAssessment,
  publishAssessment,
  closeAssessment,
  releaseAssessment,
  downloadTemplate,
  importAssessments,
  exportAssessments,
  downloadAssessment,
} = require('../controllers/assessmentController');
const { protect } = require('../middleware/auth');
const { authorize, authorizeAssessmentCreation, scopeAttendanceByTeacher } = require('../middleware/rbac');
const { auditLogger } = require('../middleware/audit');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.get('/', protect, getAssessments);
router.get('/export', protect, authorizeAssessmentCreation, exportAssessments);
router.get('/template', protect, authorizeAssessmentCreation, downloadTemplate);
router.get('/:id', protect, scopeAttendanceByTeacher, getAssessment);
router.get('/:id/download', protect, downloadAssessment);
router.post('/', protect, authorizeAssessmentCreation, auditLogger, createAssessment);
router.post('/import', protect, authorizeAssessmentCreation, auditLogger, upload.single('file'), importAssessments);
router.put('/:id', protect, authorizeAssessmentCreation, auditLogger, updateAssessment);
router.delete('/:id', protect, authorizeAssessmentCreation, auditLogger, deleteAssessment);
router.put('/:id/publish', protect, authorizeAssessmentCreation, auditLogger, publishAssessment);
router.put('/:id/release', protect, authorizeAssessmentCreation, auditLogger, releaseAssessment);
router.put('/:id/close', protect, authorizeAssessmentCreation, auditLogger, closeAssessment);

module.exports = router;