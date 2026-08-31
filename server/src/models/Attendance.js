const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
  date: { type: Date, required: true },
  timeIn: { type: Date },
  timeOut: { type: Date },
  status: {
    type: String,
    required: true,
    enum: ['present', 'absent', 'excused', 'sick', 'schoolActivity'],
    default: 'present',
  },
  remarks: { type: String, trim: true },
  deviceUsed: { type: String },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: [0, 0] },
  },
  academicYear: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicYear' },
  term: { type: mongoose.Schema.Types.ObjectId, ref: 'Term' },
  markedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

attendanceSchema.index({ student: 1, class: 1, date: 1 }, { unique: true });
attendanceSchema.index({ student: 1, date: -1 });
attendanceSchema.index({ class: 1, date: -1 });
attendanceSchema.index({ status: 1 });
attendanceSchema.index({ academicYear: 1, term: 1 });
attendanceSchema.index({ date: -1 });
attendanceSchema.index({ location: '2dsphere' });

attendanceSchema.set('toJSON', { virtuals: true });
attendanceSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Attendance', attendanceSchema);