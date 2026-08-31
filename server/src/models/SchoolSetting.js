const mongoose = require('mongoose');

const schoolSettingSchema = new mongoose.Schema({
  schoolName: { type: String, required: true, trim: true },
  schoolCode: { type: String, required: true, unique: true, trim: true, uppercase: true },
  address: {
    street: { type: String },
    city: { type: String },
    state: { type: String },
    postalCode: { type: String },
    country: { type: String },
  },
  phone: { type: String, trim: true },
  email: { type: String, trim: true, lowercase: true },
  website: { type: String, trim: true },
  logo: { type: String },
  motto: { type: String, trim: true },
  principalName: { type: String, trim: true },
  gradingSystem: {
    type: String,
    enum: ['percentage', 'cbc', 'gpa', 'letter'],
    default: 'percentage',
  },
  academicYearConfig: {
    terms: { type: Number, default: 3 },
    semesters: { type: Number, default: 0 },
  },
  reportCardConfig: {
    showLogo: { type: Boolean, default: true },
    showPhoto: { type: Boolean, default: true },
    showQR: { type: Boolean, default: true },
    showSignature: { type: Boolean, default: true },
    showStamp: { type: Boolean, default: true },
    showGraph: { type: Boolean, default: false },
  },
  sessionTimeout: { type: Number, default: 30, min: 1 },
  theme: { type: String, enum: ['light', 'dark'], default: 'light' },
  timezone: { type: String, default: 'Africa/Nairobi' },
  locale: { type: String, default: 'en' },
}, { timestamps: true });

schoolSettingSchema.set('toJSON', { virtuals: true });
schoolSettingSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('SchoolSetting', schoolSettingSchema);