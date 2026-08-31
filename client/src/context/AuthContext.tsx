import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import api from '../api/axios';
import type { User } from '../types';

type TeacherSubRole = 'class_teacher' | 'subject_teacher' | 'academic_teacher';

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  loadUser: () => void;
  isAuthenticated: boolean;
  isHeadteacher: boolean;
  isClassTeacher: boolean;
  isSubjectTeacher: boolean;
  isAcademicTeacher: boolean;
  isLibrarian: boolean;
  teacherRole: TeacherSubRole | null;
  homePath: string;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    loading: true,
    error: null,
  });

  const loadUser = useCallback(() => {
    try {
      const token = localStorage.getItem('token');
      const userJson = localStorage.getItem('user');
      if (token && userJson) {
        const user = JSON.parse(userJson) as User;
        setState({ user, token, loading: false, error: null });
      } else {
        setState({ user: null, token: null, loading: false, error: null });
      }
    } catch {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setState({ user: null, token: null, loading: false, error: null });
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const login = useCallback(async (email: string, password: string) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const res = await api.post('/auth/login', { email, password });
      const { token, user } = res.data.data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      setState({ user, token, loading: false, error: null });
    } catch (err: any) {
      const message = err.response?.data?.message || err.message || 'Login failed';
      setState({ user: null, token: null, loading: false, error: message });
      throw new Error(message);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setState({ user: null, token: null, loading: false, error: null });
  }, []);

  const role = state.user?.role;
  const isHeadteacher = role === 'headteacher';
  const isClassTeacher = role === 'class_teacher';
  const isSubjectTeacher = role === 'subject_teacher';
  const isAcademicTeacher = role === 'academic_teacher';
  const isLibrarian = role === 'librarian';
  const teacherRole: TeacherSubRole | null =
    isClassTeacher ? 'class_teacher' :
    isSubjectTeacher ? 'subject_teacher' :
    isAcademicTeacher ? 'academic_teacher' : null;
  const homePath = isLibrarian ? '/library' : '/dashboard';

  const value: AuthContextValue = {
    ...state,
    login,
    logout,
    loadUser,
    isAuthenticated: !!state.token && !!state.user,
    isHeadteacher,
    isClassTeacher,
    isSubjectTeacher,
    isAcademicTeacher,
    isLibrarian,
    teacherRole,
    homePath,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}