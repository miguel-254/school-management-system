import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { FaBars, FaMoon, FaSun, FaUserCog, FaSignOutAlt, FaChevronDown } from 'react-icons/fa';
import NotificationDropdown from '../NotificationDropdown';

interface TopbarProps {
  onMenuClick: () => void;
}

const breadcrumbMap: Record<string, string> = {
  dashboard: 'Dashboard',
  students: 'Student Management',
  teachers: 'Teacher Management',
  classes: 'Class Management',
  subjects: 'Subjects',
  attendance: 'Attendance',
  assessments: 'Assessments',
  marks: 'Marks',
  grades: 'Grades',
  'report-cards': 'Report Cards',
  reports: 'Reports',
  settings: 'Settings',
};

function getPageTitle(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return 'Dashboard';

  const root = segments[0];
  if (breadcrumbMap[root]) {
    if (segments.length === 1) return breadcrumbMap[root];
    if (segments[1] === 'new') return `New ${breadcrumbMap[root].slice(0, -1)}`;
    if (segments[1] === 'mark') return `Mark ${breadcrumbMap[root]}`;
    if (segments[1] === 'enter') return `Enter ${breadcrumbMap[root]}`;
    if (segments[1] === 'scales') return `${breadcrumbMap[root]} Scales`;
  }
  return 'Dashboard';
}

function getTheme(): boolean {
  try {
    return localStorage.getItem('theme') === 'dark';
  } catch {
    return false;
  }
}

function setTheme(dark: boolean) {
  try {
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  } catch {
  }
  if (dark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

export default function Topbar({ onMenuClick }: TopbarProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [dark, setDark] = useState(getTheme);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTheme(dark);
  }, [dark]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const title = getPageTitle(location.pathname);

  return (
    <header className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-4 lg:px-6 shrink-0">
      <div className="flex items-center gap-3">
        <button
          className="lg:hidden text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white"
          onClick={onMenuClick}
          aria-label="Toggle sidebar"
        >
          <FaBars className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
          {title}
        </h2>
      </div>

      <div className="flex items-center gap-2">
        <NotificationDropdown />

        <button
          onClick={() => setDark(!dark)}
          className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          aria-label="Toggle theme"
        >
          {dark ? <FaSun className="w-5 h-5" /> : <FaMoon className="w-5 h-5" />}
        </button>

        <div className="relative" ref={dropdownRef}>
          <button
            className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg px-3 py-2 transition-colors"
            onClick={() => setDropdownOpen(!dropdownOpen)}
          >
            <div className="w-8 h-8 bg-primary-100 dark:bg-primary-900 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-primary-700 dark:text-primary-300">
                {user?.firstName?.charAt(0)?.toUpperCase() || 'U'}
              </span>
            </div>
            <span className="hidden sm:inline">{user?.fullName || 'User'}</span>
            <FaChevronDown className="w-3 h-3" />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 z-50 py-1">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {user?.fullName}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                  {user?.role}
                </p>
              </div>

              <button
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => {
                  setDropdownOpen(false);
                  navigate('/profile');
                }}
              >
                <FaUserCog className="w-4 h-4" />
                My Profile
              </button>

              <button
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                onClick={() => {
                  setDropdownOpen(false);
                  logout();
                }}
              >
                <FaSignOutAlt className="w-4 h-4" />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
