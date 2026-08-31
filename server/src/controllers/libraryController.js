const LibraryBook = require('../models/LibraryBook');
const LibraryLoan = require('../models/LibraryLoan');
const Student = require('../models/Student');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { sendNotification } = require('../utils/notificationService');

const log = (req, action, resource, resourceId, details = {}) =>
  AuditLog.create({
    user: req.user._id,
    action,
    resource,
    resourceId,
    details,
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
  });

exports.getStats = async (req, res) => {
  try {
    const [totalBooks, availableCopies, activeLoans, overdueLoans, totalLoans, returnedLoans] = await Promise.all([
      LibraryBook.countDocuments({ isActive: true }),
      LibraryBook.aggregate([{ $match: { isActive: true } }, { $group: { _id: null, total: { $sum: '$availableCopies' } } }]),
      LibraryLoan.countDocuments({ status: 'issued' }),
      LibraryLoan.countDocuments({ status: 'issued', dueDate: { $lt: new Date() } }),
      LibraryLoan.countDocuments(),
      LibraryLoan.countDocuments({ status: 'returned' }),
    ]);

    res.json({
      success: true,
      data: {
        totalBooks,
        availableCopies: availableCopies[0]?.total || 0,
        activeLoans,
        overdueLoans,
        totalLoans,
        returnedLoans,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getBooks = async (req, res) => {
  try {
    const { search, category, status, page = 1, limit = 20 } = req.query;
    const query = {};

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { authors: { $regex: search, $options: 'i' } },
        { isbn: { $regex: search, $options: 'i' } },
        { keywords: { $regex: search, $options: 'i' } },
      ];
    }
    if (category) query.category = category;
    if (status === 'available') {
      query.isActive = true;
      query.availableCopies = { $gt: 0 };
    } else if (status === 'issued') {
      query.isActive = true;
      query.availableCopies = { $lte: 0 };
    } else {
      query.isActive = true;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [books, total] = await Promise.all([
      LibraryBook.find(query).sort({ title: 1 }).skip(skip).limit(parseInt(limit)),
      LibraryBook.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: books,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getBook = async (req, res) => {
  try {
    const book = await LibraryBook.findById(req.params.id);
    if (!book) {
      return res.status(404).json({ success: false, message: 'Book not found' });
    }
    res.json({ success: true, data: book });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createBook = async (req, res) => {
  try {
    const { title, authors, isbn, category, publisher, publishedYear, shelfLocation, language, totalCopies, keywords } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }

    if (isbn) {
      const existing = await LibraryBook.findOne({ isbn: String(isbn).toUpperCase() });
      if (existing) {
        return res.status(400).json({ success: false, message: 'A book with this ISBN already exists' });
      }
    }

    const copies = Math.max(parseInt(totalCopies) || 1, 1);

    const book = await LibraryBook.create({
      title,
      authors: Array.isArray(authors) ? authors.filter(Boolean) : (authors ? [authors] : []),
      isbn,
      category,
      publisher,
      publishedYear,
      shelfLocation,
      language,
      totalCopies: copies,
      availableCopies: copies,
      keywords: Array.isArray(keywords) ? keywords.filter(Boolean) : (keywords ? [keywords] : []),
      createdBy: req.user._id,
    });

    await log(req, 'CREATE_BOOK', 'LibraryBook', book._id, { title, isbn });

    res.status(201).json({ success: true, data: book, message: 'Book added successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateBook = async (req, res) => {
  try {
    const allowedFields = ['title', 'authors', 'isbn', 'category', 'publisher', 'publishedYear', 'shelfLocation', 'language', 'totalCopies', 'keywords', 'isActive'];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    const book = await LibraryBook.findById(req.params.id);
    if (!book) {
      return res.status(404).json({ success: false, message: 'Book not found' });
    }

    if (updates.isbn !== undefined && updates.isbn && updates.isbn.toUpperCase() !== book.isbn) {
      const existing = await LibraryBook.findOne({ isbn: String(updates.isbn).toUpperCase() });
      if (existing) {
        return res.status(400).json({ success: false, message: 'A book with this ISBN already exists' });
      }
    }

    if (updates.totalCopies !== undefined) {
      const totalCopies = Math.max(parseInt(updates.totalCopies) || 1, 1);
      const onLoan = book.totalCopies - book.availableCopies;
      if (totalCopies < onLoan) {
        return res.status(400).json({
          success: false,
          message: `Cannot reduce copies below ${onLoan} — ${onLoan} copy/copies are currently on loan`,
        });
      }
      updates.totalCopies = totalCopies;
      updates.availableCopies = totalCopies - onLoan;
    }

    const updated = await LibraryBook.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });

    await log(req, 'UPDATE_BOOK', 'LibraryBook', updated._id, { title: updated.title });

    res.json({ success: true, data: updated, message: 'Book updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteBook = async (req, res) => {
  try {
    const book = await LibraryBook.findById(req.params.id);
    if (!book) {
      return res.status(404).json({ success: false, message: 'Book not found' });
    }

    const activeLoans = await LibraryLoan.countDocuments({ book: book._id, status: 'issued' });
    if (activeLoans > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete book with ${activeLoans} active loan(s). Return all copies first.`,
      });
    }

    await LibraryBook.findByIdAndDelete(req.params.id);

    await log(req, 'DELETE_BOOK', 'LibraryBook', book._id, { title: book.title });

    res.json({ success: true, data: {}, message: 'Book deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getLoans = async (req, res) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    const query = {};

    if (status === 'overdue') {
      query.status = 'issued';
      query.dueDate = { $lt: new Date() };
    } else if (status === 'issued' || status === 'returned') {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { borrowerName: { $regex: search, $options: 'i' } },
        { borrowerId: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [loans, total] = await Promise.all([
      LibraryLoan.find(query)
        .populate('book', 'title authors isbn')
        .populate('student', 'firstName lastName admissionNumber')
        .populate('borrowerUser', 'firstName lastName email')
        .populate('issuedBy', 'firstName lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      LibraryLoan.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: loans,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.issueBook = async (req, res) => {
  try {
    const { bookId, borrowerType = 'other', studentId, userId, borrowerName, borrowerId, dueDate, notes } = req.body;

    const book = await LibraryBook.findById(bookId);
    if (!book) {
      return res.status(404).json({ success: false, message: 'Book not found' });
    }
    if (!book.isActive) {
      return res.status(400).json({ success: false, message: 'Book is deactivated' });
    }
    if (book.availableCopies <= 0) {
      return res.status(400).json({ success: false, message: 'No copies of this book are available' });
    }

    let borrower = { type: borrowerType, student: null, user: null, name: null, id: null };

    if (borrowerType === 'student') {
      if (!studentId) {
        return res.status(400).json({ success: false, message: 'Select a student borrower' });
      }
      const student = await Student.findById(studentId).select('firstName lastName admissionNumber');
      if (!student) {
        return res.status(400).json({ success: false, message: 'Student not found' });
      }
      borrower.student = student._id;
      borrower.name = `${student.firstName} ${student.lastName}`;
      borrower.id = student.admissionNumber;
    } else if (borrowerType === 'staff') {
      if (!userId) {
        return res.status(400).json({ success: false, message: 'Select a staff borrower' });
      }
      const staff = await User.findById(userId).select('firstName lastName');
      if (!staff) {
        return res.status(400).json({ success: false, message: 'Staff member not found' });
      }
      borrower.user = staff._id;
      borrower.name = `${staff.firstName} ${staff.lastName}`;
    } else {
      if (!borrowerName) {
        return res.status(400).json({ success: false, message: 'Borrower name is required' });
      }
      borrower.name = borrowerName;
      borrower.id = borrowerId || null;
    }

    const issueDate = new Date();
    const targetDue = dueDate ? new Date(dueDate) : new Date(issueDate.getTime() + 14 * 24 * 60 * 60 * 1000);
    if (targetDue <= issueDate) {
      return res.status(400).json({ success: false, message: 'Due date must be in the future' });
    }

    const loan = await LibraryLoan.create({
      book: book._id,
      borrowerType: borrower.type,
      student: borrower.student,
      borrowerUser: borrower.user,
      borrowerName: borrower.name,
      borrowerId: borrower.id,
      issuedBy: req.user._id,
      issueDate,
      dueDate: targetDue,
      notes,
    });

    book.availableCopies -= 1;
    await book.save();

    await log(req, 'ISSUE_BOOK', 'LibraryLoan', loan._id, { book: book.title, borrower: borrower.name });

    const populated = await LibraryLoan.findById(loan._id)
      .populate('book', 'title authors isbn')
      .populate('student', 'firstName lastName admissionNumber')
      .populate('borrowerUser', 'firstName lastName email')
      .populate('issuedBy', 'firstName lastName');

    let borrowerUserId = borrower.user;
    if (!borrowerUserId && borrower.student) {
      const studentDoc = await Student.findById(borrower.student).select('user');
      borrowerUserId = studentDoc?.user;
    }
    await sendNotification({
      recipient: borrowerUserId,
      type: 'general',
      title: 'Book issued to you',
      message: `"${book.title}" is due on ${targetDue.toLocaleDateString()}`,
      link: '/library/loans',
      sentBy: req.user._id,
    });

    res.status(201).json({ success: true, data: populated, message: 'Book issued successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.returnBook = async (req, res) => {
  try {
    const loan = await LibraryLoan.findById(req.params.id).populate('book', 'title');
    if (!loan) {
      return res.status(404).json({ success: false, message: 'Loan not found' });
    }
    if (loan.status === 'returned') {
      return res.status(400).json({ success: false, message: 'Book was already returned' });
    }

    const returnDate = new Date();
    let fineAmount = req.body.fineAmount !== undefined ? parseFloat(req.body.fineAmount) || 0 : 0;
    if (req.body.calculateFine) {
      const overdueDays = Math.max(Math.ceil((returnDate - loan.dueDate) / (24 * 60 * 60 * 1000)), 0);
      fineAmount = overdueDays * 50;
    }

    loan.status = 'returned';
    loan.returnDate = returnDate;
    loan.fineAmount = fineAmount;
    await loan.save();

    await LibraryBook.findByIdAndUpdate(loan.book._id, { $inc: { availableCopies: 1 } });

    await log(req, 'RETURN_BOOK', 'LibraryLoan', loan._id, { book: loan.book.title, fineAmount });

    const populated = await LibraryLoan.findById(loan._id)
      .populate('book', 'title authors isbn')
      .populate('student', 'firstName lastName admissionNumber')
      .populate('borrowerUser', 'firstName lastName email')
      .populate('issuedBy', 'firstName lastName');

    res.json({ success: true, data: populated, message: 'Book returned successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.searchStudents = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.json({ success: true, data: [] });
    }

    const query = {
      status: 'active',
      $or: [
        { firstName: { $regex: q, $options: 'i' } },
        { lastName: { $regex: q, $options: 'i' } },
        { admissionNumber: { $regex: q, $options: 'i' } },
      ],
    };

    const students = await Student.find(query)
      .select('firstName lastName admissionNumber class stream')
      .populate('class', 'name')
      .populate('stream', 'name')
      .limit(10);

    res.json({
      success: true,
      data: students.map((s) => ({
        _id: s._id,
        name: `${s.firstName} ${s.lastName}`,
        admissionNumber: s.admissionNumber,
        className: s.class?.name || null,
        streamName: s.stream?.name || null,
      })),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.searchStaff = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.json({ success: true, data: [] });
    }

    const users = await User.find({
      role: { $in: ['headteacher', 'teacher', 'class_teacher', 'subject_teacher', 'academic_teacher', 'librarian', 'admin'] },
      $or: [
        { firstName: { $regex: q, $options: 'i' } },
        { lastName: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
      ],
    })
      .select('firstName lastName email role')
      .limit(10);

    res.json({
      success: true,
      data: users.map((u) => ({
        _id: u._id,
        name: `${u.firstName} ${u.lastName}`,
        email: u.email,
        role: u.role,
      })),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
