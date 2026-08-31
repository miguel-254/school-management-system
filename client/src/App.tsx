import { Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';

import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import StudentList from './pages/students/StudentList';
import StudentForm from './pages/students/StudentForm';
import StudentDetail from './pages/students/StudentDetail';
import TeacherList from './pages/teachers/TeacherList';
import TeacherForm from './pages/teachers/TeacherForm';
import Assignments from './pages/teachers/Assignments';
import ClassList from './pages/classes/ClassList';
import ClassForm from './pages/classes/ClassForm';
import ClassDetail from './pages/classes/ClassDetail';
import SubjectList from './pages/subjects/SubjectList';
import MySubjects from './pages/curriculum/MySubjects';
import SubjectWorkspace from './pages/curriculum/SubjectWorkspace';
import CurriculumReport from './pages/curriculum/CurriculumReport';
import AttendanceList from './pages/attendance/AttendanceList';
import MarkAttendance from './pages/attendance/MarkAttendance';
import AssessmentList from './pages/assessments/AssessmentList';
import MarkList from './pages/marks/MarkList';
import EnterMarks from './pages/marks/EnterMarks';
import GradeList from './pages/grades/GradeList';
import GradeScales from './pages/grades/GradeScales';
import ReportCardList from './pages/reports/ReportCardList';
import Reports from './pages/reports/Reports';
import Settings from './pages/settings/Settings';
import Profile from './pages/Profile';
import LibraryDashboard from './pages/library/LibraryDashboard';
import BookList from './pages/library/BookList';
import Loans from './pages/library/Loans';

function ProtectedRoute() {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}

function HeadteacherRoute() {
  const { isAuthenticated, loading, isHeadteacher } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!isHeadteacher) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}

function PublicRoute() {
  const { isAuthenticated, loading, homePath } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to={homePath} replace />;
  }

  return <Outlet />;
}

export default function App() {
  return (
    <AuthProvider>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: { borderRadius: '8px', fontSize: '14px' },
        }}
      />
      <Routes>
        <Route element={<PublicRoute />}>
          <Route path="/login" element={<Login />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/students" element={<StudentList />} />
            <Route path="/students/new" element={<StudentForm />} />
            <Route path="/students/:id" element={<StudentDetail />} />
            <Route path="/subjects" element={<SubjectList />} />
            <Route path="/my-subjects" element={<MySubjects />} />
            <Route path="/curriculum/:assignmentId" element={<SubjectWorkspace />} />
            <Route path="/curriculum-report" element={<CurriculumReport />} />
            <Route path="/attendance" element={<AttendanceList />} />
            <Route path="/attendance/mark" element={<MarkAttendance />} />
            <Route path="/assessments" element={<AssessmentList />} />
            <Route path="/marks" element={<MarkList />} />
            <Route path="/marks/enter" element={<EnterMarks />} />
            <Route path="/marks/approve" element={<MarkList />} />
            <Route path="/grades" element={<GradeList />} />
            <Route path="/grades/scales" element={<GradeScales />} />
            <Route path="/report-cards" element={<ReportCardList />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/library" element={<LibraryDashboard />} />
            <Route path="/library/books" element={<BookList />} />
            <Route path="/library/loans" element={<Loans />} />
            <Route path="/profile" element={<Profile />} />
            <Route element={<HeadteacherRoute />}>
              <Route path="/teachers" element={<TeacherList />} />
              <Route path="/teachers/new" element={<TeacherForm />} />
              <Route path="/assignments" element={<Assignments />} />
              <Route path="/classes" element={<ClassList />} />
              <Route path="/classes/new" element={<ClassForm />} />
              <Route path="/classes/:id" element={<ClassDetail />} />
              <Route path="/classes/:id/edit" element={<ClassForm />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
          </Route>
        </Route>

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AuthProvider>
  );
}