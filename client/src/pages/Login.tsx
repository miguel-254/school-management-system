import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FaSchool, FaEye, FaEyeSlash, FaSpinner, FaExclamationCircle } from 'react-icons/fa';
import toast from 'react-hot-toast';

export default function Login() {
  const { login, isAuthenticated, loading: authLoading, homePath } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const savedEmail = localStorage.getItem('rememberedEmail');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      navigate(homePath, { replace: true });
    }
  }, [isAuthenticated, authLoading, navigate, homePath]);

  const validate = (): boolean => {
    setLocalError('');
    if (!email.trim()) {
      setLocalError('Email is required');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setLocalError('Please enter a valid email address');
      return false;
    }
    if (!password.trim()) {
      setLocalError('Password is required');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    if (rememberMe) {
      localStorage.setItem('rememberedEmail', email.trim());
    } else {
      localStorage.removeItem('rememberedEmail');
    }

    setSubmitting(true);
    try {
      await login(email.trim(), password);
      toast.success('Login successful');
      navigate(homePath, { replace: true });
    } catch (err: any) {
      const msg = err.message || 'Login failed. Please check your credentials.';
      setLocalError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const displayError = localError;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 relative"
      style={{
        backgroundImage: 'url(https://i.pinimg.com/1200x/be/c1/37/bec137201cce32e6b1645cc0dae1ef04.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="absolute inset-0 bg-black/50 pointer-events-none" />
      <div className="w-full max-w-md relative z-10">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 border border-gray-100 dark:border-gray-700">
          <div className="text-center mb-8">
            <div className="mx-auto w-20 h-20 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-blue-500/20">
              <FaSchool className="text-white w-10 h-10" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              School Management System
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
              Sign in to access your dashboard
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {displayError && (
              <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
                <FaExclamationCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{displayError}</span>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                placeholder="you@school.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setLocalError(''); }}
                autoComplete="email"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className="w-full px-4 py-2.5 pr-12 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setLocalError(''); }}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? <FaEyeSlash className="w-5 h-5" /> : <FaEye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <span className="text-sm text-gray-600 dark:text-gray-400">Remember me</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium rounded-lg shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <FaSpinner className="w-4 h-4 animate-spin" />
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-500 dark:text-gray-400 mt-6">
          &copy; {new Date().getFullYear()} School Management System. All rights reserved.
        </p>
      </div>
    </div>
  );
}