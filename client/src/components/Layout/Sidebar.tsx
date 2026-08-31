import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  FaChalkboardTeacher,
  FaUserGraduate,
  FaSchool,
  FaBook,
  FaClipboardCheck,
  FaFileAlt,
  FaStar,
  FaChartLine,
  FaFilePdf,
  FaChartBar,
  FaCog,
  FaClipboardList,
  FaBookOpen,
} from 'react-icons/fa';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  headteacherOnly?: boolean;
  teacherOnly?: boolean;
  classTeacherOnly?: boolean;
  subjectTeacherOnly?: boolean;
  academicTeacherOnly?: boolean;
  hideFor?: string[];
}

const navItems: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: FaChalkboardTeacher },
  { to: '/students', label: 'Student Management', icon: FaUserGraduate, hideFor: ['librarian'] },
  { to: '/teachers', label: 'Teacher Management', icon: FaChalkboardTeacher, headteacherOnly: true },
  { to: '/assignments', label: 'Assignments', icon: FaClipboardList, headteacherOnly: true },
  { to: '/classes', label: 'Class Management', icon: FaSchool, headteacherOnly: true },
  { to: '/my-subjects', label: 'My Subjects', icon: FaBook, teacherOnly: true, hideFor: ['librarian'] },
  { to: '/attendance', label: 'Attendance', icon: FaClipboardCheck, hideFor: ['subject_teacher', 'academic_teacher', 'librarian'] },
  { to: '/assessments', label: 'Assessments', icon: FaFileAlt, hideFor: ['librarian'] },
  { to: '/marks', label: 'Marks', icon: FaStar, hideFor: ['librarian'] },
  { to: '/grades', label: 'Grades', icon: FaChartLine, hideFor: ['librarian'] },
  { to: '/report-cards', label: 'Report Cards', icon: FaFilePdf, hideFor: ['librarian'] },
  { to: '/reports', label: 'Reports', icon: FaChartBar, hideFor: ['librarian'] },
  { to: '/library', label: 'Library', icon: FaBookOpen, hideFor: ['teacher', 'class_teacher', 'subject_teacher', 'academic_teacher'] },
  { to: '/settings', label: 'Settings', icon: FaCog, headteacherOnly: true },
];

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user, isHeadteacher, isAcademicTeacher } = useAuth();

  const filteredItems = navItems.filter((item) => {
    if (item.headteacherOnly && !isHeadteacher) return false;
    if (item.teacherOnly && (isHeadteacher || isAcademicTeacher)) return false;
    if (item.hideFor?.includes(user?.role || '')) return false;
    return true;
  });

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-200 lg:hidden ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col transform transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center h-16 px-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
              <FaSchool className="text-white w-4 h-4" />
            </div>
            <span className="text-lg font-bold text-gray-900 dark:text-white">
              SchoolMS
            </span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {filteredItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/dashboard'}
              className={({ isActive }) =>
                `sidebar-link ${
                  isActive
                    ? 'sidebar-link-active'
                    : 'sidebar-link-inactive'
                }`
              }
              onClick={onClose}
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 bg-primary-100 dark:bg-primary-900 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-primary-700 dark:text-primary-300">
                {user?.firstName?.charAt(0)?.toUpperCase() || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {user?.fullName || 'User'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate capitalize">
                {user?.role?.replace(/_/g, ' ') || ''}
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}