const express = require('express');
const router = express.Router();
const {
  getSubjects,
  getSubject,
  createSubject,
  updateSubject,
  deleteSubject
} = require('../controllers/subjectController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { auditLogger } = require('../middleware/audit');

router.get('/', protect, getSubjects);
router.get('/:id', protect, getSubject);
router.post('/', protect, authorize('headteacher'), auditLogger, createSubject);
router.put('/:id', protect, authorize('headteacher'), auditLogger, updateSubject);
router.delete('/:id', protect, authorize('headteacher'), auditLogger, deleteSubject);

module.exports = router;
