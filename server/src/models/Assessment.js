const mongoose = require('mongoose');

const assessmentSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  code: { type: String, required: true, unique: true, trim: true, uppercase: true },
  type: {
    type: String,
    required: true,
    enum: ['assignment', 'classExercise', 'cat', 'project', 'practical', 'midTerm', 'endTerm', 'finalExam'],
  },
  weight: { type: Number, min: 0, max: 100 },
  academicYear: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
  term: { type: mongoose.Schema.Types.ObjectId, ref: 'Term', required: true },
  subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  stream: { type: mongoose.Schema.Types.ObjectId, ref: 'Stream' },
  maxScore: { type: Number, required: true, min: 0 },
  examDate: { type: Date },
  duration: { type: Number },
  instructions: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['draft', 'released', 'published', 'closed'], default: 'draft' },
  releaseDate: { type: Date },
  isRequired: { type: Boolean, default: true },
}, { timestamps: true });

assessmentSchema.index({ academicYear: 1, term: 1 });
assessmentSchema.index({ subject: 1, class: 1, term: 1 });
assessmentSchema.index({ status: 1 });
assessmentSchema.index({ type: 1 });

assessmentSchema.set('toJSON', { virtuals: true });
assessmentSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Assessment', assessmentSchema);