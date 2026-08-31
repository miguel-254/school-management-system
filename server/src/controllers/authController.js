const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Teacher = require('../models/Teacher');
const Student = require('../models/Student');
const SchoolSetting = require('../models/SchoolSetting');
const AuditLog = require('../models/AuditLog');

const generateToken = (user) => {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

exports.register = async (req, res) => {
  try {
    const { email, password, role, firstName, lastName, phone, teacherData } = req.body;

    const allowedRoles = ['teacher', 'class_teacher', 'subject_teacher', 'academic_teacher', 'librarian'];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Role '${role || '(none)'}' cannot be created via registration. Allowed roles: ${allowedRoles.join(', ')}`,
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    const user = await User.create({ email, password, role, firstName, lastName, phone });

    if (role !== 'librarian') {
      const employeeCount = await Teacher.countDocuments();
      const prefix = role === 'academic_teacher' ? 'AT' : role === 'class_teacher' ? 'CT' : role === 'subject_teacher' ? 'ST' : 'TCH';
      const employeeId = `${prefix}/${String(employeeCount + 1).padStart(4, '0')}`;

      await Teacher.create({
        user: user._id,
        employeeId,
        firstName,
        lastName,
        ...(teacherData || {}),
      });
    }

    const token = generateToken(user);

    await AuditLog.create({
      user: user._id,
      action: 'REGISTER',
      resource: 'User',
      resourceId: user._id,
      details: { role },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.status(201).json({
      success: true,
      data: { user, token },
      message: 'Registration successful',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    if (!user.isActive) {
      return res.status(401).json({ success: false, message: 'Account has been deactivated' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user);

    let profile = null;
    if (['teacher', 'headteacher', 'class_teacher', 'subject_teacher', 'academic_teacher'].includes(user.role)) {
      profile = await Teacher.findOne({ user: user._id }).populate('subjects classAssigned');
    } else if (user.role === 'student') {
      profile = await Student.findOne({ user: user._id });
    }

    const school = await SchoolSetting.findOne();

    await AuditLog.create({
      user: user._id,
      action: 'LOGIN',
      resource: 'User',
      resourceId: user._id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({
      success: true,
      data: {
        user,
        token,
        profile,
        school,
      },
      message: 'Login successful',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    let profile = null;
    if (['teacher', 'headteacher', 'class_teacher', 'subject_teacher', 'academic_teacher'].includes(user.role)) {
      profile = await Teacher.findOne({ user: user._id })
        .populate('subjects classAssigned');
    } else if (user.role === 'student') {
      profile = await Student.findOne({ user: user._id });
    }

    const school = await SchoolSetting.findOne();

    res.json({
      success: true,
      data: { user, profile, school },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updatePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Please provide old and new password' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    const user = await User.findById(req.user._id).select('+password');

    const isMatch = await user.comparePassword(oldPassword);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Old password is incorrect' });
    }

    user.password = newPassword;
    user.passwordChangedAt = new Date();
    await user.save();

    const token = generateToken(user);

    res.json({
      success: true,
      data: { token },
      message: 'Password updated successfully',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { firstName, lastName, phone } = req.body;

    const updates = {};
    if (firstName !== undefined) updates.firstName = firstName;
    if (lastName !== undefined) updates.lastName = lastName;
    if (phone !== undefined) updates.phone = phone;

    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.role === 'teacher' || user.role === 'headteacher') {
      const teacherUpdates = {};
      if (firstName !== undefined) teacherUpdates.firstName = firstName;
      if (lastName !== undefined) teacherUpdates.lastName = lastName;
      if (phone !== undefined) teacherUpdates.phone = phone;
      await Teacher.findOneAndUpdate({ user: user._id }, teacherUpdates);
    }

    res.json({
      success: true,
      data: { user },
      message: 'Profile updated successfully',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.logout = async (req, res) => {
  try {
    await AuditLog.create({
      user: req.user._id,
      action: 'LOGOUT',
      resource: 'User',
      resourceId: req.user._id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};