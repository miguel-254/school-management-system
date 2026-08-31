const express = require('express');
const router = express.Router();
const {
  getAcademicYears,
  getAcademicYear,
  createAcademicYear,
  updateAcademicYear,
  deleteAcademicYear,
  setCurrentAcademicYear,
} = require('../controllers/academicYearController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { auditLogger } = require('../middleware/audit');

router.get('/', protect, getAcademicYears);
router.get('/:id', protect, getAcademicYear);
router.post('/', protect, authorize('headteacher'), auditLogger, createAcademicYear);
router.put('/:id', protect, authorize('headteacher'), auditLogger, updateAcademicYear);
router.delete('/:id', protect, authorize('headteacher'), auditLogger, deleteAcademicYear);
router.put('/:id/set-current', protect, authorize('headteacher'), auditLogger, setCurrentAcademicYear);

module.exports = router;