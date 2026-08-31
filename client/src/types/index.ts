export type UserRole = 'headteacher' | 'teacher' | 'admin' | 'class_teacher' | 'subject_teacher' | 'academic_teacher' | 'librarian';
export type AttendanceStatus = 'present' | 'absent' | 'excused' | 'sick' | 'schoolActivity';
export type AssessmentType = 'assignment' | 'classExercise' | 'cat' | 'project' | 'practical' | 'midTerm' | 'endTerm' | 'finalExam';
export type GradingSystem = 'percentage' | 'cbc' | 'gpa' | 'letter';
export type StudentStatus = 'active' | 'graduated' | 'transferred' | 'archived';
export type Theme = 'light' | 'dark';

export interface User {
  _id: string;
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  fullName: string;
  phone?: string;
  isActive: boolean;
  lastLogin?: string;
  passwordChangedAt?: string;
  schoolId?: string;
  createdAt: string;
  updatedAt: string;
}

export type TeacherDesignation = 'head_of_academics' | 'head_of_department' | 'senior_teacher' | 'teacher';

export const DESIGNATION_LABELS: Record<TeacherDesignation, string> = {
  head_of_academics: 'Head of Academics',
  head_of_department: 'Head of Department',
  senior_teacher: 'Senior Teacher',
  teacher: 'Teacher',
};

export interface Teacher {
  _id: string;
  user: User | string;
  employeeId: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  qualifications: string;
  subjects: string[];
  classAssigned?: string;
  designation?: TeacherDesignation;
  isClassTeacher?: boolean;
  dateOfEmployment: string;
  address: string;
  fullName: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GuardianInfo {
  name: string;
  phone: string;
  email?: string;
  relationship: string;
  address?: string;
}

export interface AcademicHistory {
  year: string;
  term: string;
  class: string;
  stream?: string;
  average: number;
  position: number;
  status: string;
}

export interface SchoolFees {
  totalFee: number;
  amountPaid: number;
}

export interface Student {
  _id: string;
  user?: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  fullName: string;
  gender: 'male' | 'female';
  dateOfBirth: string;
  class: Class | string;
  stream?: Stream | string;
  guardianInfo: GuardianInfo;
  address?: string;
  emergencyContact?: string;
  medicalInfo?: string;
  passportPhoto?: string;
  enrollmentDate: string;
  status: StudentStatus;
  academicHistory: AcademicHistory[];
  previousSchool?: string;
  schoolFees?: SchoolFees;
  createdAt: string;
  updatedAt: string;
}

export interface Class {
  _id: string;
  name: string;
  code: string;
  description?: string;
  department?: string;
  academicYear: AcademicYear | string;
  classTeacher?: Teacher | string;
  capacity?: number;
  streams: (Stream | string)[];
  subjects: (Subject | string)[];
  createdAt: string;
  updatedAt: string;
}

export interface Stream {
  _id: string;
  name: string;
  code: string;
  class: Class | string;
  description?: string;
}

export interface Subject {
  _id: string;
  name: string;
  code: string;
  description?: string;
  department?: string;
  category: 'core' | 'elective' | 'optional';
  credits: number;
  createdAt: string;
  updatedAt: string;
}

export interface TeacherAssignment {
  _id: string;
  teacher: Teacher | string;
  class: Class | string;
  subject?: Subject | string;
  stream?: Stream | string;
  academicYear?: AcademicYear | string;
  term?: Term | string;
  teacherRole: 'subject_teacher' | 'class_teacher' | 'academic_teacher';
  isClassTeacher: boolean;
  assignedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AcademicYear {
  _id: string;
  name: string;
  year: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  terms: (Term | string)[];
}

export interface Term {
  _id: string;
  name: string;
  academicYear: AcademicYear | string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
}

export interface Attendance {
  _id: string;
  student: Student | string;
  teacher: Teacher | string;
  class: Class | string;
  subject: Subject | string;
  date: string;
  timeIn?: string;
  timeOut?: string;
  status: AttendanceStatus;
  remarks?: string;
  deviceUsed?: string;
  location?: { type: string; coordinates: number[] };
  academicYear: string;
  term: string;
  markedBy: string;
}

export interface Assessment {
  _id: string;
  name: string;
  code: string;
  type: AssessmentType;
  weight: number;
  academicYear: string;
  term: string;
  subject: string;
  class: string;
  stream?: string;
  maxScore: number;
  examDate?: string;
  releaseDate?: string;
  duration?: number;
  instructions?: string;
  createdBy: string;
  status: 'draft' | 'released' | 'published' | 'closed';
  isRequired: boolean;
}

export interface Mark {
  _id: string;
  student: Student | string;
  assessment: Assessment | string;
  subject: Subject | string;
  class: Class | string;
  stream?: Stream | string;
  academicYear: string;
  term: string;
  score: number;
  totalScore: number;
  grade?: string;
  gradePoint?: number;
  remarks?: string;
  gradedBy: string;
  isApproved: boolean;
  approvedBy?: string;
  approvedAt?: string;
  isMissing: boolean;
  submittedAt: string;
}

export interface GradeScale {
  _id: string;
  name: string;
  code: string;
  minScore: number;
  maxScore: number;
  gradePoint: number;
  description: string;
  remark: string;
  system: GradingSystem;
  isActive: boolean;
}

export interface ReportCard {
  _id: string;
  student: Student | string;
  academicYear: string;
  term: string;
  class: string;
  stream?: string;
  subjects: ReportCardSubject[];
  totalScore: number;
  averageScore: number;
  grade: string;
  gradePoint: number;
  position: number;
  classSize: number;
  attendanceSummary: AttendanceSummary;
  teacherRemarks?: string;
  headteacherRemarks?: string;
  generatedBy: string;
  generatedAt: string;
  isPublished: boolean;
  qrCode?: string;
  templateVersion: string;
}

export interface ReportCardSubject {
  subject: Subject | string;
  score: number;
  grade: string;
  gradePoint: number;
  remarks: string;
  teacherComments?: string;
}

export interface AttendanceSummary {
  totalDays: number;
  present: number;
  absent: number;
  excused: number;
  percentage: number;
}

export interface Notification {
  _id: string;
  recipient: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  link?: string;
  sentBy: string;
  createdAt: string;
}

export interface AuditLog {
  _id: string;
  user: User | string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
}

export interface SchoolSettings {
  _id: string;
  schoolName: string;
  schoolCode: string;
  address: string;
  phone: string;
  email: string;
  website?: string;
  logo?: string;
  motto?: string;
  principalName: string;
  gradingSystem: GradingSystem;
  academicYearConfig: { terms: number; semesters: number };
  reportCardConfig: { showLogo: boolean; showPhoto: boolean; showQR: boolean; showSignature: boolean; showStamp: boolean; showGraph: boolean };
  sessionTimeout: number;
  theme: Theme;
  timezone: string;
  locale: string;
}

export interface DashboardStats {
  totalStudents: number;
  totalTeachers: number;
  totalClasses: number;
  attendanceToday: number;
  attendancePercentage: number;
  studentsAbsent: number;
  averagePerformance: number;
  upcomingExams: any[];
  recentResults: any[];
  topStudents: any[];
  lowSubjects: any[];
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  count?: number;
  pagination?: { page: number; limit: number; total: number; pages: number };
}

export type LessonStatus = 'not_started' | 'in_progress' | 'completed';

export interface CurriculumLesson {
  _id: string;
  assignment: string;
  topic: string;
  title: string;
  order: number;
  duration?: number;
  objectives: string[];
  outline: string[];
  notes?: string;
  homework?: string;
  assessmentNotes?: string;
  status: LessonStatus;
  completedAt?: string | null;
  completedBy?: string | null;
  reopenedAt?: string | null;
  resourceCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CurriculumTopic {
  _id: string;
  assignment: string;
  title: string;
  description?: string;
  order: number;
  estimatedLessons?: number;
  notes?: string;
  status: LessonStatus;
  completedLessons: number;
  lessons: CurriculumLesson[];
  createdAt: string;
  updatedAt: string;
}

export interface LessonResource {
  _id: string;
  lesson: string;
  assignment: string;
  title: string;
  description?: string;
  type: string;
  url: string;
  createdAt: string;
  updatedAt: string;
}

export interface LessonEvent {
  _id: string;
  action: 'completed' | 'reopened';
  by: any;
  at: string;
}

export interface AssignmentStats {
  totalTopics: number;
  completedTopics: number;
  totalLessons: number;
  completedLessons: number;
  overallPercent: number;
  lastUpdated: string | null;
  currentTopic: { _id: string; title: string } | null;
  currentLesson: { _id: string; title: string; topicId: string } | null;
}

export interface CurriculumAssignment {
  _id: string;
  teacher: any;
  subject: any;
  class: any;
  stream: any;
  academicYear: any;
  term: any;
  teacherName?: string;
  stats: AssignmentStats;
}

export interface CurriculumReportRow {
  assignmentId: string;
  teacherName: string;
  subjectName: string;
  className: string;
  streamName: string;
  yearName?: string;
  termName?: string;
  topicsCompleted: number;
  totalTopics: number;
  lessonsCompleted: number;
  totalLessons: number;
  overallPercent: number;
  currentTopic: string | null;
  currentLesson: string | null;
  lastActivity: string | null;
  status: string;
}

export interface LibraryBook {
  _id: string;
  title: string;
  authors: string[];
  isbn?: string;
  category?: string;
  publisher?: string;
  publishedYear?: number;
  shelfLocation?: string;
  language?: string;
  totalCopies: number;
  availableCopies: number;
  keywords: string[];
  isActive: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export type LibraryBorrowerType = 'student' | 'staff' | 'other';

export interface LibraryLoan {
  _id: string;
  book: LibraryBook | string;
  borrowerType: LibraryBorrowerType;
  student?: Student | string;
  borrowerUser?: User | string;
  borrowerName?: string;
  borrowerId?: string;
  issuedBy: User | string;
  issueDate: string;
  dueDate: string;
  returnDate?: string;
  status: 'issued' | 'returned';
  fineAmount: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LibraryStats {
  totalBooks: number;
  availableCopies: number;
  activeLoans: number;
  overdueLoans: number;
  totalLoans: number;
  returnedLoans: number;
}

export interface ExamDocument {
  _id: string;
  title: string;
  filename: string;
  originalName: string;
  size: number;
  mimeType?: string;
  class: Class | string;
  subject: Subject | string;
  stream?: Stream | string;
  term?: Term | string;
  uploadedBy?: User | string;
  createdAt: string;
  updatedAt: string;
}