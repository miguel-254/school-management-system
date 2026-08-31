const mongoose = require('mongoose');

const lessonResourceSchema = new mongoose.Schema(
  {
    lesson: { type: mongoose.Schema.Types.ObjectId, ref: 'CurriculumLesson', required: true, index: true },
    assignment: { type: mongoose.Schema.Types.ObjectId, ref: 'TeacherAssignment', required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    type: {
      type: String,
      enum: ['pdf', 'document', 'image', 'video', 'url', 'worksheet', 'presentation', 'other'],
      default: 'other',
    },
    url: { type: String, trim: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

lessonResourceSchema.index({ lesson: 1, deletedAt: 1 });

module.exports = mongoose.model('LessonResource', lessonResourceSchema);
