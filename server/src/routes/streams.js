const express = require('express');
const router = express.Router();
const {
  getStreams,
} = require('../controllers/classController');
const { protect } = require('../middleware/auth');

router.get('/', protect, getStreams);

module.exports = router;
