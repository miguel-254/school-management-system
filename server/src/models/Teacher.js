const mongoose = require('mongoose');

const teacherSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  employeeId: { type: String, required: true, unique: true, trim: true },
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  gender: { type: String, enum: ['male', 'female', 'other'] },
  dateOfBirth: { type: Date },
  qualifications: [{
    degree: { type: String },
    institution: { type: String },
    year: { type: Number },
    field: { type: String },
  }],
  subjects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Subject' }],
  classAssigned: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
  designation: { type: String, enum: ['head_of_academics', 'head_of_department', 'senior_teacher', 'teacher'], default: 'teacher' },
  dateOfEmployment: { type: Date },
  emergencyContact: {
    name: { type: String },
    phone: { type: String },
    relationship: { type: String },
  },
  address: {
    street: { type: String },
    city: { type: String },
    state: { type: String },
    postalCode: { type: String },
    country: { type: String },
  },
  documents: [{
    type: { type: String },
    url: { type: String },
    uploadedAt: { type: Date, default: Date.now },
  }],
}, { timestamps: true });

teacherSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

teacherSchema.set('toJSON', { virtuals: true });
teacherSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Teacher', teacherSchema);