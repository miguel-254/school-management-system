const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');
const path = require('path');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');

dotenv.config({ path: path.join(__dirname, '../.env') });

const authRoutes = require('./routes/auth');
const teacherRoutes = require('./routes/teachers');
const studentRoutes = require('./routes/students');
const classRoutes = require('./routes/classes');
const subjectRoutes = require('./routes/subjects');
const attendanceRoutes = require('./routes/attendance');
const assessmentRoutes = require('./routes/assessments');
const markRoutes = require('./routes/marks');
const gradeRoutes = require('./routes/grades');
const gradeScaleRoutes = require('./routes/gradeScales');
const termRoutes = require('./routes/terms');
const streamRoutes = require('./routes/streams');
const reportCardRoutes = require('./routes/reportCards');
const dashboardRoutes = require('./routes/dashboard');
const notificationRoutes = require('./routes/notifications');
const settingsRoutes = require('./routes/settings');
const reportRoutes = require('./routes/reports');
const academicYearRoutes = require('./routes/academicYears');
const assignmentRoutes = require('./routes/assignments');
const curriculumRoutes = require('./routes/curriculum');
const libraryRoutes = require('./routes/library');
const examDocumentRoutes = require('./routes/examDocuments');

const app = express();

connectDB();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(morgan('dev'));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api', limiter);

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/teachers', teacherRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/assessments', assessmentRoutes);
app.use('/api/marks', markRoutes);
app.use('/api/grades', gradeRoutes);
app.use('/api/grade-scales', gradeScaleRoutes);
app.use('/api/terms', termRoutes);
app.use('/api/streams', streamRoutes);
app.use('/api/report-cards', reportCardRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/academic-years', academicYearRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/curriculum', curriculumRoutes);
app.use('/api/library', libraryRoutes);
app.use('/api/exam-documents', examDocumentRoutes);

const { startOverdueJob } = require('./services/libraryOverdueJob');
startOverdueJob();

app.use((req, res, next) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use((err, req, res, next) => {
  const isMulterError = err && err.name === 'MulterError';
  const isFileFilterError = err && typeof err.message === 'string' && /^Only (image|CSV|Excel|Word|PDF)/.test(err.message);
  if (isMulterError || isFileFilterError) {
    return res.status(400).json({ error: err.message || 'Invalid file upload' });
  }
  console.error(err.stack);
  res.status(err.statusCode || 500).json({
    error: err.message || 'Internal Server Error'
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;

