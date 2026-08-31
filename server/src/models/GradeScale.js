const mongoose = require('mongoose');

const gradeScaleSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  code: { type: String, required: true, trim: true, uppercase: true },
  minScore: { type: Number, required: true, min: 0 },
  maxScore: { type: Number, required: true, min: 0 },
  gradePoint: { type: Number, required: true, min: 0 },
  description: { type: String, trim: true },
  remark: { type: String, trim: true },
  system: {
    type: String,
    required: true,
    enum: ['percentage', 'cbc', 'gpa', 'letter'],
    default: 'percentage',
  },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

gradeScaleSchema.index({ code: 1 });
gradeScaleSchema.index({ system: 1, isActive: 1 });
gradeScaleSchema.index({ minScore: 1, maxScore: 1, system: 1 });

gradeScaleSchema.set('toJSON', { virtuals: true });
gradeScaleSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('GradeScale', gradeScaleSchema);