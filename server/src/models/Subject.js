const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  code: { type: String, required: true, unique: true, trim: true, uppercase: true },
  description: { type: String, trim: true },
  department: { type: String, trim: true },
  category: { type: String, enum: ['core', 'elective', 'optional'], default: 'core' },
  credits: { type: Number, default: 1, min: 0 },
}, { timestamps: true });

subjectSchema.index({ category: 1 });
subjectSchema.index({ department: 1 });

subjectSchema.set('toJSON', { virtuals: true });
subjectSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Subject', subjectSchema);