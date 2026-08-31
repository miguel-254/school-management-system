const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const {
  getSchoolSettings,
  updateSchoolSettings,
  uploadLogo,
  backupDatabase,
  restoreDatabase,
  getAuditLogs
} = require('../controllers/settingsController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { auditLogger } = require('../middleware/audit');

const logoFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'];
  const allowedExt = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
  const ext = file.originalname ? path.extname(file.originalname).toLowerCase() : '';
  if (allowedTypes.includes(file.mimetype) && allowedExt.includes(ext)) {
    return cb(null, true);
  }
  return cb(new Error('Only image files (JPEG, PNG, GIF, WEBP, BMP) are allowed'));
};

const uploadLogoMulter = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: logoFilter,
});

router.get('/school', protect, authorize('headteacher'), getSchoolSettings);
router.put('/school', protect, authorize('headteacher'), auditLogger, updateSchoolSettings);
router.post('/logo', protect, authorize('headteacher'), auditLogger, uploadLogoMulter.single('logo'), uploadLogo);
router.post('/backup', protect, authorize('headteacher'), auditLogger, backupDatabase);
router.get('/backup/info', protect, authorize('headteacher'), (req, res) => {
  const backupDir = path.join(__dirname, '..', '..', 'backups');
  try {
    if (fs.existsSync(backupDir)) {
      const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.json')).sort().reverse();
      res.json({ success: true, data: { lastBackup: files.length > 0 ? files[0] : null } });
    } else {
      res.json({ success: true, data: { lastBackup: null } });
    }
  } catch { res.json({ success: true, data: { lastBackup: null } }); }
});
router.get('/backup/export', protect, authorize('headteacher'), async (req, res) => {
  try {
    const data = require('../controllers/settingsController');
    const backupDir = path.join(__dirname, '..', '..', 'backups');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `backup_${timestamp}.json`);
    const SchoolSetting = require('../models/SchoolSetting');
    const User = require('../models/User');
    const Teacher = require('../models/Teacher');
    const Student = require('../models/Student');
    const Class = require('../models/Class');
    const Subject = require('../models/Subject');
    const Attendance = require('../models/Attendance');
    const Mark = require('../models/Mark');
    const Assessment = require('../models/Assessment');
    const GradeScale = require('../models/GradeScale');
    const ReportCard = require('../models/ReportCard');
    const Notification = require('../models/Notification');
    const AcademicYear = require('../models/AcademicYear');
    const Term = require('../models/Term');
    const TeacherAssignment = require('../models/TeacherAssignment');
    const Stream = require('../models/Stream');
    const backupData = {
      schoolSettings: await SchoolSetting.findOne().lean(),
      users: await User.find().lean(), teachers: await Teacher.find().lean(),
      students: await Student.find().lean(), classes: await Class.find().lean(),
      streams: await Stream.find().lean(), subjects: await Subject.find().lean(),
      academicYears: await AcademicYear.find().lean(), terms: await Term.find().lean(),
      assessments: await Assessment.find().lean(), marks: await Mark.find().lean(),
      attendance: await Attendance.find().lean(), gradeScales: await GradeScale.find().lean(),
      reportCards: await ReportCard.find().lean(), notifications: await Notification.find().lean(),
      teacherAssignments: await TeacherAssignment.find().lean(),
      exportedAt: new Date().toISOString(),
    };
    fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
    const AuditLog = require('../models/AuditLog');
    await AuditLog.create({ user: req.user._id, action: 'BACKUP_DATABASE', resource: 'SchoolSetting', details: { filename: `backup_${timestamp}.json` }, ipAddress: req.ip, userAgent: req.get('User-Agent') });
    res.download(backupPath, `backup-${new Date().toISOString().split('T')[0]}.json`);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
router.post('/backup/import', protect, authorize('headteacher'), auditLogger, restoreDatabase);
router.post('/restore', protect, authorize('headteacher'), auditLogger, restoreDatabase);
router.get('/audit-logs', protect, authorize('headteacher'), getAuditLogs);
router.get('/audit-logs/export', protect, authorize('headteacher'), getAuditLogs);

module.exports = router;
