const express = require('express');
const router = express.Router();
const multer = require('multer');
const {
  uploadDocument,
  listDocuments,
  downloadDocument,
  deleteDocument,
} = require('../controllers/examDocumentController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { auditLogger } = require('../middleware/audit');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.post('/', protect, authorize('academic_teacher', 'headteacher', 'admin'), auditLogger, upload.single('file'), uploadDocument);
router.get('/', protect, listDocuments);
router.get('/:id/download', protect, downloadDocument);
router.delete('/:id', protect, authorize('academic_teacher', 'headteacher', 'admin'), auditLogger, deleteDocument);

module.exports = router;
