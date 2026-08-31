const mongoose = require('mongoose');

const libraryLoanSchema = new mongoose.Schema({
  book: { type: mongoose.Schema.Types.ObjectId, ref: 'LibraryBook', required: true },
  borrowerType: { type: String, enum: ['student', 'staff', 'other'], default: 'student' },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
  borrowerUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  borrowerName: { type: String, trim: true },
  borrowerId: { type: String, trim: true },
  issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  issueDate: { type: Date, default: Date.now },
  dueDate: { type: Date, required: true },
  returnDate: { type: Date },
  status: { type: String, enum: ['issued', 'returned'], default: 'issued' },
  fineAmount: { type: Number, default: 0, min: 0 },
  overdueNotified: { type: Boolean, default: false },
  notes: { type: String, trim: true },
}, { timestamps: true });

libraryLoanSchema.index({ book: 1, status: 1 });
libraryLoanSchema.index({ status: 1, dueDate: 1 });
libraryLoanSchema.index({ student: 1, status: 1 });

libraryLoanSchema.set('toJSON', { virtuals: true });
libraryLoanSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('LibraryLoan', libraryLoanSchema);
