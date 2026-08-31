const mongoose = require('mongoose');

const libraryBookSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  authors: [{ type: String, trim: true }],
  isbn: { type: String, unique: true, sparse: true, trim: true, uppercase: true },
  category: { type: String, trim: true },
  publisher: { type: String, trim: true },
  publishedYear: { type: Number, min: 0 },
  shelfLocation: { type: String, trim: true },
  language: { type: String, trim: true },
  totalCopies: { type: Number, required: true, min: 0, default: 1 },
  availableCopies: { type: Number, min: 0, default: 1 },
  keywords: [{ type: String, trim: true }],
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

libraryBookSchema.index({ title: 'text', authors: 'text', isbn: 'text', category: 'text', keywords: 'text' });
libraryBookSchema.index({ category: 1 });
libraryBookSchema.index({ isActive: 1 });

libraryBookSchema.set('toJSON', { virtuals: true });
libraryBookSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('LibraryBook', libraryBookSchema);
