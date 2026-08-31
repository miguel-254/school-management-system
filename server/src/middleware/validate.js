const { body, param, query, validationResult } = require('express-validator');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map((err) => ({
        field: err.path,
        message: err.msg,
        value: err.value,
      })),
    });
  }
  next();
};

const login = [
  body('email')
    .isEmail()
    .withMessage('Valid email is required')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
];

const registerStudent = [
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('First name is required')
    .isAlpha('en-US', { ignore: ' -' })
    .withMessage('First name must contain only letters'),
  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Last name is required')
    .isAlpha('en-US', { ignore: ' -' })
    .withMessage('Last name must contain only letters'),
  body('gender')
    .trim()
    .notEmpty()
    .withMessage('Gender is required')
    .isIn(['male', 'female', 'other'])
    .withMessage('Gender must be male, female, or other'),
  body('dateOfBirth')
    .optional()
    .isISO8601()
    .withMessage('Valid date of birth is required'),
  body('class')
    .notEmpty()
    .withMessage('Class is required')
    .isMongoId()
    .withMessage('Invalid class ID'),
  body('stream')
    .optional()
    .isMongoId()
    .withMessage('Invalid stream ID'),
  body('guardianInfo.name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Guardian name cannot be empty'),
  body('guardianInfo.phone')
    .optional()
    .trim()
    .isMobilePhone('any')
    .withMessage('Valid guardian phone number is required'),
  body('guardianInfo.email')
    .optional()
    .isEmail()
    .withMessage('Valid guardian email is required')
    .normalizeEmail(),
  body('emergencyContact.name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Emergency contact name cannot be empty'),
  body('emergencyContact.phone')
    .optional()
    .trim()
    .isMobilePhone('any')
    .withMessage('Valid emergency contact phone is required'),
];

const registerTeacher = [
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('First name is required')
    .isAlpha('en-US', { ignore: ' -' })
    .withMessage('First name must contain only letters'),
  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Last name is required')
    .isAlpha('en-US', { ignore: ' -' })
    .withMessage('Last name must contain only letters'),
  body('email')
    .isEmail()
    .withMessage('Valid email is required')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  body('gender')
    .optional()
    .trim()
    .isIn(['male', 'female', 'other'])
    .withMessage('Gender must be male, female, or other'),
  body('employeeId')
    .trim()
    .notEmpty()
    .withMessage('Employee ID is required'),
  body('subjects')
    .optional()
    .isArray()
    .withMessage('Subjects must be an array'),
  body('subjects.*')
    .optional()
    .isMongoId()
    .withMessage('Each subject must be a valid ID'),
  body('phone')
    .optional()
    .trim()
    .isMobilePhone('any')
    .withMessage('Valid phone number is required'),
];

const createClass = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Class name is required'),
  body('code')
    .trim()
    .notEmpty()
    .withMessage('Class code is required')
    .isUppercase()
    .withMessage('Class code must be uppercase'),
  body('description')
    .optional()
    .trim(),
  body('department')
    .optional()
    .trim(),
  body('capacity')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Capacity must be between 1 and 100'),
  body('classTeacher')
    .optional()
    .isMongoId()
    .withMessage('Invalid teacher ID'),
  body('academicYear')
    .notEmpty()
    .withMessage('Academic year is required')
    .isMongoId()
    .withMessage('Invalid academic year ID'),
  body('subjects')
    .optional()
    .isArray()
    .withMessage('Subjects must be an array'),
  body('subjects.*')
    .optional()
    .isMongoId()
    .withMessage('Each subject must be a valid ID'),
];

const createSubject = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Subject name is required'),
  body('code')
    .trim()
    .notEmpty()
    .withMessage('Subject code is required')
    .isUppercase()
    .withMessage('Subject code must be uppercase'),
  body('description')
    .optional()
    .trim(),
  body('department')
    .optional()
    .trim(),
  body('category')
    .optional()
    .trim()
    .isIn(['core', 'elective', 'optional'])
    .withMessage('Category must be core, elective, or optional'),
  body('credits')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Credits must be a non-negative integer'),
];

const markAttendance = [
  body('date')
    .notEmpty()
    .withMessage('Date is required')
    .isISO8601()
    .withMessage('Valid date is required'),
  body('class')
    .notEmpty()
    .withMessage('Class is required')
    .isMongoId()
    .withMessage('Invalid class ID'),
  body('subject')
    .optional()
    .isMongoId()
    .withMessage('Invalid subject ID'),
  body('records')
    .isArray({ min: 1 })
    .withMessage('At least one attendance record is required'),
  body('records.*.student')
    .isMongoId()
    .withMessage('Each record must have a valid student ID'),
  body('records.*.status')
    .isIn(['present', 'absent', 'excused', 'sick', 'schoolActivity'])
    .withMessage('Status must be present, absent, excused, sick, or schoolActivity'),
  body('records.*.timeIn')
    .optional()
    .isISO8601()
    .withMessage('Valid time in is required'),
  body('records.*.timeOut')
    .optional()
    .isISO8601()
    .withMessage('Valid time out is required'),
  body('records.*.remarks')
    .optional()
    .trim(),
  body('academicYear')
    .notEmpty()
    .withMessage('Academic year is required')
    .isMongoId()
    .withMessage('Invalid academic year ID'),
  body('term')
    .notEmpty()
    .withMessage('Term is required')
    .isMongoId()
    .withMessage('Invalid term ID'),
];

const createAssessment = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Assessment name is required'),
  body('code')
    .trim()
    .notEmpty()
    .withMessage('Assessment code is required')
    .isUppercase()
    .withMessage('Assessment code must be uppercase'),
  body('type')
    .trim()
    .notEmpty()
    .withMessage('Assessment type is required')
    .isIn(['assignment', 'classExercise', 'cat', 'project', 'practical', 'midTerm', 'endTerm', 'finalExam'])
    .withMessage('Invalid assessment type'),
  body('weight')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Weight must be between 0 and 100'),
  body('maxScore')
    .notEmpty()
    .withMessage('Maximum score is required')
    .isFloat({ min: 0 })
    .withMessage('Maximum score must be a positive number'),
  body('academicYear')
    .notEmpty()
    .withMessage('Academic year is required')
    .isMongoId()
    .withMessage('Invalid academic year ID'),
  body('term')
    .notEmpty()
    .withMessage('Term is required')
    .isMongoId()
    .withMessage('Invalid term ID'),
  body('subject')
    .notEmpty()
    .withMessage('Subject is required')
    .isMongoId()
    .withMessage('Invalid subject ID'),
  body('class')
    .notEmpty()
    .withMessage('Class is required')
    .isMongoId()
    .withMessage('Invalid class ID'),
  body('stream')
    .optional()
    .isMongoId()
    .withMessage('Invalid stream ID'),
  body('examDate')
    .optional()
    .isISO8601()
    .withMessage('Valid exam date is required'),
  body('duration')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Duration must be a positive integer'),
  body('instructions')
    .optional()
    .trim(),
];

const enterMarks = [
  body('class')
    .notEmpty()
    .withMessage('Class is required')
    .isMongoId()
    .withMessage('Invalid class ID'),
  body('subject')
    .notEmpty()
    .withMessage('Subject is required')
    .isMongoId()
    .withMessage('Invalid subject ID'),
  body('assessment')
    .notEmpty()
    .withMessage('Assessment is required')
    .isMongoId()
    .withMessage('Invalid assessment ID'),
  body('academicYear')
    .notEmpty()
    .withMessage('Academic year is required')
    .isMongoId()
    .withMessage('Invalid academic year ID'),
  body('term')
    .notEmpty()
    .withMessage('Term is required')
    .isMongoId()
    .withMessage('Invalid term ID'),
  body('marks')
    .isArray({ min: 1 })
    .withMessage('At least one mark is required'),
  body('marks.*.student')
    .isMongoId()
    .withMessage('Each mark must have a valid student ID'),
  body('marks.*.score')
    .isFloat({ min: 0 })
    .withMessage('Score must be a non-negative number'),
  body('marks.*.totalScore')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Total score must be a non-negative number'),
];

const assignmentId = [
  param('id')
    .isMongoId()
    .withMessage('Invalid assignment ID'),
];

const createAssignment = [
  body('teacher')
    .notEmpty()
    .withMessage('Teacher is required')
    .isMongoId()
    .withMessage('Invalid teacher ID'),
  body('class')
    .notEmpty()
    .withMessage('Class is required')
    .isMongoId()
    .withMessage('Invalid class ID'),
  body('subject')
    .optional({ checkFalsy: true })
    .isMongoId()
    .withMessage('Invalid subject ID'),
  body('stream')
    .optional({ checkFalsy: true })
    .isMongoId()
    .withMessage('Invalid stream ID'),
  body('academicYear')
    .optional({ checkFalsy: true })
    .isMongoId()
    .withMessage('Invalid academic year ID'),
  body('term')
    .optional({ checkFalsy: true })
    .isMongoId()
    .withMessage('Invalid term ID'),
  body('teacherRole')
    .optional()
    .isIn(['subject_teacher', 'class_teacher', 'academic_teacher'])
    .withMessage('teacherRole must be subject_teacher, class_teacher, or academic_teacher'),
  body('isClassTeacher')
    .optional()
    .isBoolean()
    .withMessage('isClassTeacher must be a boolean'),
];

module.exports = {
  validate,
  login,
  registerStudent,
  registerTeacher,
  createClass,
  createSubject,
  markAttendance,
  createAssessment,
  enterMarks,
  assignmentId,
  createAssignment,
};
