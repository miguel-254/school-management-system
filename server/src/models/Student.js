const mongoose = require('mongoose');

const academicHistorySchema = new mongoose.Schema({
  year: { type: String },
  term: { type: String },
  class: { type: String },
  stream: { type: String },
  average: { type: Number },
  position: { type: Number },
  status: { type: String },
}, { _id: false });

const studentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  admissionNumber: { type: String, unique: true, trim: true },
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  gender: { type: String, enum: ['male', 'female', 'other'], required: true },
  dateOfBirth: { type: Date },
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
  stream: { type: mongoose.Schema.Types.ObjectId, ref: 'Stream' },
  guardianInfo: {
    name: { type: String },
    phone: { type: String },
    email: { type: String },
    relationship: { type: String },
    address: { type: String },
  },
  address: { type: String },
  emergencyContact: { type: String },
  medicalInfo: { type: String },
  passportPhoto: { type: String },
  enrollmentDate: { type: Date, default: Date.now },
  status: { type: String, enum: ['active', 'graduated', 'transferred', 'archived'], default: 'active' },
  academicHistory: [academicHistorySchema],
  previousSchool: { type: String },
  schoolFees: {
    totalFee: { type: Number, default: 0 },
    amountPaid: { type: Number, default: 0 },
  },
}, { timestamps: true });

studentSchema.pre('save', async function(next) {
  if (this.isNew && !this.admissionNumber) {
    const year = new Date().getFullYear();
    const count = await mongoose.model('Student').countDocuments();
    this.admissionNumber = `STU/${year}/${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

studentSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

studentSchema.index({ class: 1, stream: 1 });
studentSchema.index({ status: 1 });
studentSchema.index({ lastName: 1, firstName: 1 });

studentSchema.set('toJSON', { virtuals: true });
studentSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Student', studentSchema);