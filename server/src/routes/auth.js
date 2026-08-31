const express = require('express');
const router = express.Router();
const {
  register,
  login,
  getMe,
  updatePassword,
  updateProfile,
  logout
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { auditLogger } = require('../middleware/audit');

router.post('/register', protect, authorize('headteacher'), auditLogger, register);
router.post('/login', login);
router.get('/me', protect, getMe);
router.put('/password', protect, updatePassword);
router.put('/profile', protect, updateProfile);
router.post('/logout', protect, logout);

module.exports = router;
