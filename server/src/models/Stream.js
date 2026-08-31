const mongoose = require('mongoose');

const streamSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  code: { type: String, required: true, unique: true, trim: true, uppercase: true },
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  description: { type: String, trim: true },
}, { timestamps: true });

streamSchema.index({ class: 1 });

streamSchema.set('toJSON', { virtuals: true });
streamSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Stream', streamSchema);