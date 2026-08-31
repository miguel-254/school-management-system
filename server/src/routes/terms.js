const express = require('express');
const router = express.Router();
const {
  getTerms,
  getTerm,
  createTerm,
  updateTerm,
  deleteTerm,
} = require('../controllers/termController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { auditLogger } = require('../middleware/audit');

router.get('/', protect, getTerms);
router.get('/:id', protect, getTerm);
router.post('/', protect, authorize('headteacher'), auditLogger, createTerm);
router.put('/:id', protect, authorize('headteacher'), auditLogger, updateTerm);
router.delete('/:id', protect, authorize('headteacher'), auditLogger, deleteTerm);

module.exports = router;
