const mongoose = require('mongoose');

const examDocumentSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  filename: { type: String, required: true, trim: true },
  originalName: { type: String, required: true, trim: true },
  size: { type: Number, required: true },
  mimeType: { type: String, trim: true },
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  stream: { type: mongoose.Schema.Types.ObjectId, ref: 'Stream' },
  term: { type: mongoose.Schema.Types.ObjectId, ref: 'Term' },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

examDocumentSchema.index({ class: 1, subject: 1 });
examDocumentSchema.index({ uploadedBy: 1 });

examDocumentSchema.set('toJSON', { virtuals: true });
examDocumentSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('ExamDocument', examDocumentSchema);
