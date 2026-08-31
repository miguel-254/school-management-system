const mongoose = require('mongoose');

const curriculumLessonSchema = new mongoose.Schema(
  {
    assignment: { type: mongoose.Schema.Types.ObjectId, ref: 'TeacherAssignment', required: true, index: true },
    topic: { type: mongoose.Schema.Types.ObjectId, ref: 'CurriculumTopic', required: true, index: true },
    title: { type: String, required: true, trim: true },
    order: { type: Number, default: 1 },
    duration: { type: Number, min: 0 },
    objectives: { type: [String], default: [] },
    outline: { type: [String], default: [] },
    notes: { type: String, trim: true },
    homework: { type: String, trim: true },
    assessmentNotes: { type: String, trim: true },
    status: { type: String, enum: ['not_started', 'in_progress', 'completed'], default: 'not_started' },
    completedAt: { type: Date, default: null },
    completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reopenedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

curriculumLessonSchema.index({ assignment: 1, deletedAt: 1, topic: 1, order: 1 });
curriculumLessonSchema.index({ topic: 1, order: 1 });

module.exports = mongoose.model('CurriculumLesson', curriculumLessonSchema);
