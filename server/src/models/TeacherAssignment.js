const mongoose = require('mongoose');

const teacherAssignmentSchema = new mongoose.Schema({
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
  stream: { type: mongoose.Schema.Types.ObjectId, ref: 'Stream' },
  academicYear: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicYear' },
  term: { type: mongoose.Schema.Types.ObjectId, ref: 'Term' },
  teacherRole: { type: String, enum: ['subject_teacher', 'class_teacher', 'academic_teacher'], default: 'subject_teacher' },
  isClassTeacher: { type: Boolean, default: false },
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

teacherAssignmentSchema.index({ teacher: 1, academicYear: 1, term: 1 });
teacherAssignmentSchema.index({ teacher: 1, class: 1, subject: 1 }, { unique: true, sparse: true });
teacherAssignmentSchema.index({ class: 1, stream: 1 });
teacherAssignmentSchema.index({ subject: 1 });
teacherAssignmentSchema.index({ isClassTeacher: 1 });

teacherAssignmentSchema.set('toJSON', { virtuals: true });
teacherAssignmentSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('TeacherAssignment', teacherAssignmentSchema);