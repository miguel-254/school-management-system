const mongoose = require('mongoose');

const classSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  code: { type: String, required: true, unique: true, trim: true, uppercase: true },
  description: { type: String, trim: true },
  department: { type: String, trim: true },
  academicYear: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicYear' },
  classTeacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
  capacity: { type: Number, default: 40 },
  streams: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Stream' }],
  subjects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Subject' }],
}, { timestamps: true });

classSchema.index({ academicYear: 1 });
classSchema.index({ classTeacher: 1 });

classSchema.set('toJSON', { virtuals: true });
classSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Class', classSchema);