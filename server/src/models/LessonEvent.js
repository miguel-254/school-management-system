const mongoose = require('mongoose');

const lessonEventSchema = new mongoose.Schema(
  {
    lesson: { type: mongoose.Schema.Types.ObjectId, ref: 'CurriculumLesson', required: true, index: true },
    assignment: { type: mongoose.Schema.Types.ObjectId, ref: 'TeacherAssignment', required: true, index: true },
    action: { type: String, enum: ['completed', 'reopened'], required: true },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    at: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

lessonEventSchema.index({ lesson: 1, at: -1 });

module.exports = mongoose.model('LessonEvent', lessonEventSchema);
