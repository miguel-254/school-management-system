const express = require('express');
const router = express.Router();
const {
  getStats,
  getBooks,
  getBook,
  createBook,
  updateBook,
  deleteBook,
  getLoans,
  issueBook,
  returnBook,
  searchStudents,
  searchStaff,
} = require('../controllers/libraryController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { auditLogger } = require('../middleware/audit');

const LIBRARY_ROLES = ['librarian', 'headteacher', 'admin'];

router.get('/stats', protect, authorize(...LIBRARY_ROLES), getStats);
router.get('/books', protect, authorize(...LIBRARY_ROLES), getBooks);
router.get('/books/:id', protect, authorize(...LIBRARY_ROLES), getBook);
router.post('/books', protect, authorize(...LIBRARY_ROLES), auditLogger, createBook);
router.put('/books/:id', protect, authorize(...LIBRARY_ROLES), auditLogger, updateBook);
router.delete('/books/:id', protect, authorize(...LIBRARY_ROLES), auditLogger, deleteBook);
router.get('/loans', protect, authorize(...LIBRARY_ROLES), getLoans);
router.post('/loans/issue', protect, authorize(...LIBRARY_ROLES), auditLogger, issueBook);
router.post('/loans/:id/return', protect, authorize(...LIBRARY_ROLES), auditLogger, returnBook);
router.get('/students/search', protect, authorize(...LIBRARY_ROLES), searchStudents);
router.get('/staff/search', protect, authorize(...LIBRARY_ROLES), searchStaff);

module.exports = router;
