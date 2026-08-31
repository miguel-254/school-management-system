const mongoose = require('mongoose');

const termSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  academicYear: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  isCurrent: { type: Boolean, default: false },
  examCategories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Assessment' }],
}, { timestamps: true });

termSchema.index({ academicYear: 1 });
termSchema.index({ isCurrent: 1 });
termSchema.index({ academicYear: 1, isCurrent: 1 });

termSchema.set('toJSON', { virtuals: true });
termSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Term', termSchema);