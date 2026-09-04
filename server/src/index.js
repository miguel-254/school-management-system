const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');
const path = require('path');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');

// ==========================================
// ENVIRONMENT VARIABLES
// ==========================================

dotenv.config({
  path: path.join(__dirname, '../.env')
});

// ==========================================
// ROUTES
// ==========================================

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

// ==========================================
// EXPRESS APP
// ==========================================

const app = express();

// ==========================================
// DATABASE CONNECTION
// ==========================================

connectDB();

// ==========================================
// SECURITY
// ==========================================

app.use(helmet());

// ==========================================
// CORS CONFIGURATION
// ==========================================

/*
  These are permanent frontend URLs.

  Local development URLs are included for testing
  the application locally.
*/

const allowedOrigins = [
  // Local development
  'http://localhost:5173',
  'http://localhost:3000',

  // Main Vercel production domain
  'https://school-management-system-vjzy.vercel.app'
];

/*
  CORS validation.

  The regex allows Vercel deployments generated
  specifically for this school-management project.

  Examples:

  https://school-management-system-vjzy-xxxx.vercel.app
*/

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests without Origin
    // Examples:
    // - Postman
    // - Server-to-server requests
    // - Health checks
    if (!origin) {
      return callback(null, true);
    }

    // Check explicitly allowed origins
    const isExplicitlyAllowed =
      allowedOrigins.includes(origin);

    /*
      Allow Vercel preview/production deployment URLs
      for this specific project.

      Examples allowed:

      school-management-system-vjzy-xxxx.vercel.app
    */

    const isVercelDeployment =
      /^https:\/\/school-management-system-vjzy-[a-z0-9-]+\.vercel\.app$/i.test(
        origin
      );

    // Allow valid origins
    if (isExplicitlyAllowed || isVercelDeployment) {
      return callback(null, true);
    }

    // Log blocked origin
    console.log(`CORS blocked origin: ${origin}`);

    return callback(
      new Error(`CORS blocked origin: ${origin}`)
    );
  },

  // Allow authentication credentials
  credentials: true,

  // Allowed HTTP methods
  methods: [
    'GET',
    'POST',
    'PUT',
    'PATCH',
    'DELETE',
    'OPTIONS'
  ],

  // Allowed request headers
  allowedHeaders: [
    'Content-Type',
    'Authorization'
  ],

  // Response status for OPTIONS requests
  optionsSuccessStatus: 204
};

// Apply CORS globally
app.use(cors(corsOptions));

// Explicitly handle preflight OPTIONS requests
app.options('*', cors(corsOptions));

// ==========================================
// BODY PARSING
// ==========================================

app.use(
  express.json({
    limit: '50mb'
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: '50mb'
  })
);

// ==========================================
// REQUEST LOGGING
// ==========================================

app.use(morgan('dev'));

// ==========================================
// HEALTH CHECK ROUTES
// ==========================================

app.get('/', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'School Management API is running'
  });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'School Management API is healthy'
  });
});

// ==========================================
// RATE LIMITING
// ==========================================

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,

  // Maximum requests per IP
  max: 2000,

  standardHeaders: true,

  legacyHeaders: false,

  message: {
    error:
      'Too many requests, please try again later.'
  }
});

// Apply rate limiting to API routes
app.use('/api', limiter);

// ==========================================
// STATIC FILES
// ==========================================

app.use(
  '/uploads',
  express.static(
    path.join(__dirname, '../uploads')
  )
);

// ==========================================
// API ROUTES
// ==========================================

// Authentication
app.use('/api/auth', authRoutes);

// Teachers
app.use('/api/teachers', teacherRoutes);

// Students
app.use('/api/students', studentRoutes);

// Classes
app.use('/api/classes', classRoutes);

// Subjects
app.use('/api/subjects', subjectRoutes);

// Attendance
app.use('/api/attendance', attendanceRoutes);

// Assessments
app.use('/api/assessments', assessmentRoutes);

// Marks
app.use('/api/marks', markRoutes);

// Grades
app.use('/api/grades', gradeRoutes);

// Grade Scales
app.use('/api/grade-scales', gradeScaleRoutes);

// Terms
app.use('/api/terms', termRoutes);

// Streams
app.use('/api/streams', streamRoutes);

// Report Cards
app.use('/api/report-cards', reportCardRoutes);

// Dashboard
app.use('/api/dashboard', dashboardRoutes);

// Notifications
app.use('/api/notifications', notificationRoutes);

// Settings
app.use('/api/settings', settingsRoutes);

// Reports
app.use('/api/reports', reportRoutes);

// Academic Years
app.use(
  '/api/academic-years',
  academicYearRoutes
);

// Assignments
app.use('/api/assignments', assignmentRoutes);

// Curriculum
app.use('/api/curriculum', curriculumRoutes);

// Library
app.use('/api/library', libraryRoutes);

// Exam Documents
app.use(
  '/api/exam-documents',
  examDocumentRoutes
);

// ==========================================
// BACKGROUND JOBS
// ==========================================

const {
  startOverdueJob
} = require('./services/libraryOverdueJob');

// Start library overdue checking job
startOverdueJob();

// ==========================================
// 404 HANDLER
// ==========================================

app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found'
  });
});

// ==========================================
// GLOBAL ERROR HANDLER
// ==========================================

app.use((err, req, res, next) => {
  // Log error
  console.error(err);

  // ========================================
  // MULTER FILE UPLOAD ERRORS
  // ========================================

  const isMulterError =
    err &&
    err.name === 'MulterError';

  // ========================================
  // CUSTOM FILE FILTER ERRORS
  // ========================================

  const isFileFilterError =
    err &&
    typeof err.message === 'string' &&
    /^Only (image|CSV|Excel|Word|PDF)/.test(
      err.message
    );

  if (isMulterError || isFileFilterError) {
    return res.status(400).json({
      error:
        err.message ||
        'Invalid file upload'
    });
  }

  // ========================================
  // CORS ERRORS
  // ========================================

  if (
    err &&
    err.message &&
    err.message.startsWith(
      'CORS blocked origin:'
    )
  ) {
    return res.status(403).json({
      error: 'CORS policy blocked this request.'
    });
  }

  // ========================================
  // GENERAL ERRORS
  // ========================================

  return res.status(
    err.statusCode || 500
  ).json({
    error:
      err.message ||
      'Internal Server Error'
  });
});

// ==========================================
// START SERVER
// ==========================================

const PORT =
  process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(
    `Server running on port ${PORT}`
  );
});

// ==========================================
// EXPORT APP
// ==========================================

module.exports = app;