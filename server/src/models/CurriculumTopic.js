const mongoose = require('mongoose');

const curriculumTopicSchema = new mongoose.Schema(
  {
    assignment: { type: mongoose.Schema.Types.ObjectId, ref: 'TeacherAssignment', required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    order: { type: Number, default: 1 },
    estimatedLessons: { type: Number, min: 0 },
    notes: { type: String, trim: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

curriculumTopicSchema.index({ assignment: 1, deletedAt: 1, order: 1 });

module.exports = mongoose.model('CurriculumTopic', curriculumTopicSchema);
