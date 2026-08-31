const express = require('express');
const router = express.Router();
const {
  getAssignments,
  getAssignment,
  createAssignment,
  updateAssignment,
  deleteAssignment,
} = require('../controllers/assignmentController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { auditLogger } = require('../middleware/audit');
const { validate, assignmentId, createAssignment: assignmentRules } = require('../middleware/validate');

router.get('/', protect, authorize('headteacher'), getAssignments);
router.get('/:id', protect, authorize('headteacher'), assignmentId, validate, getAssignment);
router.post('/', protect, authorize('headteacher'), auditLogger, assignmentRules, validate, createAssignment);
router.put('/:id', protect, authorize('headteacher'), auditLogger, assignmentId, assignmentRules, validate, updateAssignment);
router.delete('/:id', protect, authorize('headteacher'), auditLogger, assignmentId, validate, deleteAssignment);

module.exports = router;
