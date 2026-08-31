const AuditLog = require('../models/AuditLog');

const getResourceFromPath = (path) => {
  const segments = path.split('/').filter(Boolean);
  if (segments.length > 0) {
    if (segments[0] === 'api' && segments.length > 1) {
      return segments[1];
    }
    return segments[0];
  }
  return path;
};

const getResourceIdFromParams = (params) => {
  const idKeys = ['id', 'studentId', 'teacherId', 'classId', 'subjectId', 'assessmentId', 'userId', 'markId', 'streamId', 'termId', 'yearId', 'assignmentId', 'topicId', 'lessonId', 'resourceId'];
  for (const key of idKeys) {
    if (params[key]) return params[key];
  }
  return null;
};

const getDetailsSummary = (body) => {
  if (!body || Object.keys(body).length === 0) return null;
  const summary = { ...body };
  if (summary.password) summary.password = '[REDACTED]';
  if (summary.confirmPassword) summary.confirmPassword = '[REDACTED]';
  if (summary.token) summary.token = '[REDACTED]';
  if (Buffer.isBuffer(summary) || summary instanceof Buffer) return { type: 'Buffer' };
  return summary;
};

const auditLogger = (req, res, next) => {
  const originalEnd = res.end;

  res.end = function (...args) {
    res.end = originalEnd;
    res.end.apply(res, args);

    if (res.statusCode >= 400 && res.statusCode < 500) return;

    const action = `${req.method} ${req.originalUrl || req.url}`;
    const resource = getResourceFromPath(req.originalUrl || req.url);
    const resourceId = getResourceIdFromParams(req.params);

    const logEntry = {
      user: req.user ? req.user._id : undefined,
      action,
      resource,
      resourceId,
      details: getDetailsSummary(req.body),
      ipAddress: req.ip || req.connection?.remoteAddress || null,
      userAgent: req.get('User-Agent') || null,
    };

    AuditLog.create(logEntry).catch((err) => {
      console.error('Audit log creation failed:', err.message);
    });
  };

  next();
};

module.exports = { auditLogger };
