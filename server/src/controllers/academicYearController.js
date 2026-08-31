const AcademicYear = require('../models/AcademicYear');
const AuditLog = require('../models/AuditLog');

exports.getAcademicYears = async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const years = await AcademicYear.find().sort({ year: -1 }).limit(parseInt(limit)).populate('terms');
    res.json({ success: true, data: years });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAcademicYear = async (req, res) => {
  try {
    const year = await AcademicYear.findById(req.params.id).populate('terms');
    if (!year) {
      return res.status(404).json({ success: false, message: 'Academic year not found' });
    }
    res.json({ success: true, data: year });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createAcademicYear = async (req, res) => {
  try {
    const { name, year, startDate, endDate, isCurrent } = req.body;
    if (!name || !year || !startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'name, year, startDate and endDate are required' });
    }
    if (isCurrent) {
      await AcademicYear.updateMany({}, { isCurrent: false });
    }
    const academicYear = await AcademicYear.create({ name, year, startDate, endDate, isCurrent });
    await AuditLog.create({
      user: req.user._id, action: 'CREATE_ACADEMIC_YEAR', resource: 'AcademicYear',
      resourceId: academicYear._id, details: { name, year }, ipAddress: req.ip, userAgent: req.get('User-Agent'),
    });
    res.status(201).json({ success: true, data: academicYear, message: 'Academic year created' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateAcademicYear = async (req, res) => {
  try {
    const { name, year, startDate, endDate, isCurrent } = req.body;
    if (isCurrent) {
      await AcademicYear.updateMany({ _id: { $ne: req.params.id } }, { isCurrent: false });
    }
    const updated = await AcademicYear.findByIdAndUpdate(
      req.params.id, { name, year, startDate, endDate, isCurrent }, { new: true, runValidators: true }
    );
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Academic year not found' });
    }
    await AuditLog.create({
      user: req.user._id, action: 'UPDATE_ACADEMIC_YEAR', resource: 'AcademicYear',
      resourceId: updated._id, details: { name }, ipAddress: req.ip, userAgent: req.get('User-Agent'),
    });
    res.json({ success: true, data: updated, message: 'Academic year updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteAcademicYear = async (req, res) => {
  try {
    const deleted = await AcademicYear.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Academic year not found' });
    }
    await AuditLog.create({
      user: req.user._id, action: 'DELETE_ACADEMIC_YEAR', resource: 'AcademicYear',
      resourceId: req.params.id, ipAddress: req.ip, userAgent: req.get('User-Agent'),
    });
    res.json({ success: true, data: {}, message: 'Academic year deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.setCurrentAcademicYear = async (req, res) => {
  try {
    await AcademicYear.updateMany({}, { isCurrent: false });
    const year = await AcademicYear.findByIdAndUpdate(req.params.id, { isCurrent: true }, { new: true });
    if (!year) {
      return res.status(404).json({ success: false, message: 'Academic year not found' });
    }
    await AuditLog.create({
      user: req.user._id, action: 'SET_CURRENT_ACADEMIC_YEAR', resource: 'AcademicYear',
      resourceId: year._id, ipAddress: req.ip, userAgent: req.get('User-Agent'),
    });
    res.json({ success: true, data: year, message: 'Current academic year updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};