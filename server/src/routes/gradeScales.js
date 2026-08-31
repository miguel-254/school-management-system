const express = require('express');
const router = express.Router();
const {
  getGradeScales,
  createGradeScale,
  updateGradeScale,
  deleteGradeScale,
} = require('../controllers/gradeController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { auditLogger } = require('../middleware/audit');

router.get('/', protect, getGradeScales);
router.post('/', protect, authorize('headteacher'), auditLogger, createGradeScale);
router.put('/:id', protect, authorize('headteacher'), auditLogger, updateGradeScale);
router.delete('/:id', protect, authorize('headteacher'), auditLogger, deleteGradeScale);

module.exports = router;
