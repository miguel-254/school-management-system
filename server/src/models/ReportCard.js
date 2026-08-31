const mongoose = require('mongoose');

const subjectResultSchema = new mongoose.Schema({
  subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  score: { type: Number, min: 0 },
  grade: { type: String },
  gradePoint: { type: Number, min: 0 },
  remarks: { type: String, trim: true },
  teacherComments: { type: String, trim: true },
}, { _id: false });

const attendanceSummarySchema = new mongoose.Schema({
  totalDays: { type: Number, default: 0 },
  present: { type: Number, default: 0 },
  absent: { type: Number, default: 0 },
  excused: { type: Number, default: 0 },
  percentage: { type: Number, default: 0 },
}, { _id: false });

const reportCardSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  academicYear: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
  term: { type: mongoose.Schema.Types.ObjectId, ref: 'Term', required: true },
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  stream: { type: mongoose.Schema.Types.ObjectId, ref: 'Stream' },
  subjects: [subjectResultSchema],
  totalScore: { type: Number, min: 0 },
  averageScore: { type: Number, min: 0 },
  grade: { type: String },
  gradePoint: { type: Number, min: 0 },
  position: { type: Number, min: 0 },
  classSize: { type: Number, min: 0 },
  attendanceSummary: attendanceSummarySchema,
  teacherRemarks: { type: String, trim: true },
  headteacherRemarks: { type: String, trim: true },
  generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  generatedAt: { type: Date, default: Date.now },
  isPublished: { type: Boolean, default: false },
  qrCode: { type: String },
  templateVersion: { type: String, default: '1.0' },
}, { timestamps: true });

reportCardSchema.index({ student: 1, academicYear: 1, term: 1 }, { unique: true });
reportCardSchema.index({ academicYear: 1, term: 1, class: 1 });
reportCardSchema.index({ isPublished: 1 });
reportCardSchema.index({ student: 1 });

reportCardSchema.set('toJSON', { virtuals: true });
reportCardSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('ReportCard', reportCardSchema);