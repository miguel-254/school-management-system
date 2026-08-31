const mongoose = require('mongoose');

const markSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  assessment: { type: mongoose.Schema.Types.ObjectId, ref: 'Assessment', required: true },
  subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  stream: { type: mongoose.Schema.Types.ObjectId, ref: 'Stream' },
  academicYear: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
  term: { type: mongoose.Schema.Types.ObjectId, ref: 'Term', required: true },
  score: { type: Number, required: true, min: 0 },
  totalScore: { type: Number, min: 0 },
  grade: { type: String },
  gradePoint: { type: Number, min: 0 },
  remarks: { type: String, trim: true },
  gradedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isApproved: { type: Boolean, default: false },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: { type: Date },
  isMissing: { type: Boolean, default: false },
  submittedAt: { type: Date, default: Date.now },
}, { timestamps: true });

markSchema.index({ student: 1, assessment: 1 }, { unique: true });
markSchema.index({ student: 1, term: 1, subject: 1 });
markSchema.index({ assessment: 1 });
markSchema.index({ class: 1, subject: 1, term: 1 });
markSchema.index({ isApproved: 1 });
markSchema.index({ academicYear: 1, term: 1, class: 1, subject: 1 });
markSchema.index({ gradedBy: 1 });

markSchema.set('toJSON', { virtuals: true });
markSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Mark', markSchema);