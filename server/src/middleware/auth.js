const jwt = require('jsonwebtoken');
const User = require('../models/User');

const LIBRARIAN_ALLOWED_PATHS = [
  '/api/library',
  '/api/auth/me',
  '/api/auth/password',
  '/api/auth/profile',
  '/api/auth/logout',
];

const protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this resource',
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User no longer exists',
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account has been deactivated',
      });
    }

    if (user.passwordChangedAt && decoded.iat) {
      const changedAt = parseInt(user.passwordChangedAt.getTime() / 1000, 10);
      if (decoded.iat < changedAt) {
        return res.status(401).json({
          success: false,
          message: 'Password recently changed. Please log in again.',
        });
      }
    }

    if (user.role === 'librarian' && !LIBRARIAN_ALLOWED_PATHS.some((p) => req.originalUrl.startsWith(p))) {
      return res.status(403).json({
        success: false,
        message: 'Librarian accounts can only access the library module',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token',
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token has expired',
      });
    }
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this resource',
    });
  }
};

module.exports = { protect };
