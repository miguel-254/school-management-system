const Term = require('../models/Term');
const AcademicYear = require('../models/AcademicYear');
const AuditLog = require('../models/AuditLog');

exports.getTerms = async (req, res) => {
  try {
    const { academicYear, isCurrent } = req.query;
    const query = {};
    if (academicYear) query.academicYear = academicYear;
    if (isCurrent !== undefined) query.isCurrent = isCurrent === 'true';
    const terms = await Term.find(query).populate('examCategories').sort({ startDate: 1 });
    res.json({ success: true, data: terms });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getTerm = async (req, res) => {
  try {
    const term = await Term.findById(req.params.id).populate('examCategories');
    if (!term) return res.status(404).json({ success: false, message: 'Term not found' });
    res.json({ success: true, data: term });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createTerm = async (req, res) => {
  try {
    const { name, academicYear, startDate, endDate, isCurrent } = req.body;
    if (!name || !academicYear || !startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'name, academicYear, startDate and endDate are required' });
    }
    if (isCurrent) {
      await Term.updateMany({ academicYear }, { isCurrent: false });
    }
    const term = await Term.create({ name, academicYear, startDate, endDate, isCurrent });
    await AcademicYear.findByIdAndUpdate(academicYear, { $addToSet: { terms: term._id } });
    await AuditLog.create({
      user: req.user._id, action: 'CREATE_TERM', resource: 'Term',
      resourceId: term._id, details: { name, academicYear }, ipAddress: req.ip, userAgent: req.get('User-Agent'),
    });
    res.status(201).json({ success: true, data: term, message: 'Term created' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateTerm = async (req, res) => {
  try {
    const { name, startDate, endDate, isCurrent } = req.body;
    const term = await Term.findById(req.params.id);
    if (!term) return res.status(404).json({ success: false, message: 'Term not found' });
    if (isCurrent) {
      await Term.updateMany({ academicYear: term.academicYear }, { isCurrent: false });
    }
    if (name !== undefined) term.name = name;
    if (startDate !== undefined) term.startDate = startDate;
    if (endDate !== undefined) term.endDate = endDate;
    if (isCurrent !== undefined) term.isCurrent = isCurrent;
    await term.save();
    await AuditLog.create({
      user: req.user._id, action: 'UPDATE_TERM', resource: 'Term',
      resourceId: term._id, details: { name }, ipAddress: req.ip, userAgent: req.get('User-Agent'),
    });
    res.json({ success: true, data: term, message: 'Term updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteTerm = async (req, res) => {
  try {
    const term = await Term.findByIdAndDelete(req.params.id);
    if (!term) return res.status(404).json({ success: false, message: 'Term not found' });
    await AcademicYear.findByIdAndUpdate(term.academicYear, { $pull: { terms: term._id } });
    await AuditLog.create({
      user: req.user._id, action: 'DELETE_TERM', resource: 'Term',
      resourceId: req.params.id, ipAddress: req.ip, userAgent: req.get('User-Agent'),
    });
    res.json({ success: true, data: {}, message: 'Term deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
