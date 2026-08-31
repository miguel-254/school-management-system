const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const {
  getStudents,
  getStudent,
  createStudent,
  updateStudent,
  deleteStudent,
  uploadPhoto,
  bulkImport,
  promoteStudents,
  getStudentHistory,
  getGuardianInfo
} = require('../controllers/studentController');
const { protect } = require('../middleware/auth');
const { authorize, scopeStudentsByTeacher, authorizeStudentEdit, authorizeStudentView } = require('../middleware/rbac');
const { auditLogger } = require('../middleware/audit');

const imageFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'];
  const allowedExt = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
  const ext = file.originalname ? path.extname(file.originalname).toLowerCase() : '';
  if (allowedTypes.includes(file.mimetype) && allowedExt.includes(ext)) {
    return cb(null, true);
  }
  return cb(new Error('Only image files (JPEG, PNG, GIF, WEBP, BMP) are allowed'));
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFilter,
});

const spreadsheetFilter = (req, file, cb) => {
  const allowedTypes = [
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ];
  const allowedExt = ['.csv', '.xls', '.xlsx'];
  const ext = file.originalname ? path.extname(file.originalname).toLowerCase() : '';
  if (allowedTypes.includes(file.mimetype) && allowedExt.includes(ext)) {
    return cb(null, true);
  }
  return cb(new Error('Only CSV or Excel files are allowed'));
};

const uploadSpreadsheet = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: spreadsheetFilter,
});

router.get('/', protect, scopeStudentsByTeacher, getStudents);
router.get('/:id', protect, scopeStudentsByTeacher, authorizeStudentView, getStudent);
router.post('/', protect, authorize('headteacher'), auditLogger, createStudent);
router.put('/:id', protect, authorize('headteacher', 'class_teacher', 'academic_teacher', 'teacher'), authorizeStudentEdit, auditLogger, updateStudent);
router.delete('/:id', protect, authorize('headteacher'), auditLogger, deleteStudent);
router.post('/:id/photo', protect, authorize('headteacher'), auditLogger, upload.single('passportPhoto'), uploadPhoto);
router.post('/bulk-import', protect, authorize('headteacher'), auditLogger, uploadSpreadsheet.single('file'), bulkImport);
router.post('/promote', protect, authorize('headteacher'), auditLogger, promoteStudents);
router.get('/:id/history', protect, scopeStudentsByTeacher, authorizeStudentView, getStudentHistory);
router.get('/:id/guardian', protect, scopeStudentsByTeacher, authorizeStudentView, getGuardianInfo);

module.exports = router;
