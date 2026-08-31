const express = require('express');
const router = express.Router();
const {
  getMarks,
  enterMarks,
  bulkEnterMarks,
  approveMarks,
  getMissingMarks,
  getSubjectMarks,
  getStudentMarks,
  updateMark,
  getStudentsForEntry,
  getSubjectPerformanceComparison,
} = require('../controllers/markController');
const { protect } = require('../middleware/auth');
const { authorize, authorizeSubjectAccess, scopeAttendanceByTeacher, authorizeStudentView } = require('../middleware/rbac');
const { validate, enterMarks: bulkMarksValidation } = require('../middleware/validate');
const { auditLogger } = require('../middleware/audit');

const { body } = require('express-validator');

const singleMarkValidation = [
  body('student').notEmpty().withMessage('Student is required').isMongoId().withMessage('Invalid student ID'),
  body('assessment').notEmpty().withMessage('Assessment is required').isMongoId().withMessage('Invalid assessment ID'),
  body('subject').notEmpty().withMessage('Subject is required').isMongoId().withMessage('Invalid subject ID'),
  body('class').notEmpty().withMessage('Class is required').isMongoId().withMessage('Invalid class ID'),
  body('score').isFloat({ min: 0 }).withMessage('Score must be a non-negative number'),
];

router.get('/', protect, scopeAttendanceByTeacher, getMarks);
router.post('/enter', protect, authorize('subject_teacher', 'class_teacher', 'headteacher'), authorizeSubjectAccess, ...singleMarkValidation, validate, auditLogger, enterMarks);
router.post('/bulk-enter', protect, authorize('subject_teacher', 'class_teacher', 'headteacher'), authorizeSubjectAccess, ...bulkMarksValidation, validate, auditLogger, bulkEnterMarks);
router.put('/:id/approve', protect, authorize('headteacher'), auditLogger, approveMarks);
router.get('/students-for-entry', protect, scopeAttendanceByTeacher, getStudentsForEntry);
router.get('/missing/:assessmentId', protect, scopeAttendanceByTeacher, getMissingMarks);
router.get('/subject/:subjectId', protect, scopeAttendanceByTeacher, getSubjectMarks);
router.get('/student/:studentId', protect, scopeAttendanceByTeacher, authorizeStudentView, getStudentMarks);
router.put('/:id', protect, authorize('subject_teacher', 'class_teacher', 'headteacher'), authorizeSubjectAccess, auditLogger, updateMark);
router.get('/performance/:subjectId', protect, scopeAttendanceByTeacher, getSubjectPerformanceComparison);
router.get('/performance', protect, scopeAttendanceByTeacher, getSubjectPerformanceComparison);

module.exports = router;