const mongoose = require('mongoose');

const academicYearSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  year: { type: String, required: true, trim: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  isCurrent: { type: Boolean, default: false },
  terms: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Term' }],
}, { timestamps: true });

academicYearSchema.index({ isCurrent: 1 });
academicYearSchema.index({ year: 1 });

academicYearSchema.set('toJSON', { virtuals: true });
academicYearSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('AcademicYear', academicYearSchema);