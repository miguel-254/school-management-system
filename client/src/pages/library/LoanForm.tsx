import { useState, useEffect, type FormEvent } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { FaSearch } from 'react-icons/fa';
import type { LibraryBook, LibraryBorrowerType } from '../../types';

interface LoanFormProps {
  presetBookId?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

interface StudentOption {
  _id: string;
  name: string;
  admissionNumber: string;
  className: string | null;
  streamName: string | null;
}

interface StaffOption {
  _id: string;
  name: string;
  email: string;
  role: string;
}

export default function LoanForm({ presetBookId, onSuccess, onCancel }: LoanFormProps) {
  const [books, setBooks] = useState<LibraryBook[]>([]);
  const [form, setForm] = useState({
    bookId: presetBookId || '',
    borrowerType: 'student' as LibraryBorrowerType,
    studentId: '',
    userId: '',
    borrowerName: '',
    borrowerId: '',
    dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    notes: '',
  });
  const [studentQuery, setStudentQuery] = useState('');
  const [staffQuery, setStaffQuery] = useState('');
  const [studentResults, setStudentResults] = useState<StudentOption[]>([]);
  const [staffResults, setStaffResults] = useState<StaffOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    api.get('/library/books', { params: { limit: 100 } }).then((res) => {
      setBooks((res.data.data || []).filter((b: LibraryBook) => b.isActive && b.availableCopies > 0));
    }).catch(() => toast.error('Failed to load books'));
  }, []);

  useEffect(() => {
    if (form.borrowerType !== 'student' || !studentQuery.trim()) {
      setStudentResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api.get('/library/students/search', { params: { q: studentQuery } });
        setStudentResults(res.data.data || []);
      } catch {
        setStudentResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [studentQuery, form.borrowerType]);

  useEffect(() => {
    if (form.borrowerType !== 'staff' || !staffQuery.trim()) {
      setStaffResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api.get('/library/staff/search', { params: { q: staffQuery } });
        setStaffResults(res.data.data || []);
      } catch {
        setStaffResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [staffQuery, form.borrowerType]);

  const handleChange = (field: string, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.bookId) errs.bookId = 'Select a book';
    if (form.borrowerType === 'student' && !form.studentId) errs.studentId = 'Search and select a student';
    if (form.borrowerType === 'staff' && !form.userId) errs.userId = 'Search and select a staff member';
    if (form.borrowerType === 'other' && !form.borrowerName.trim()) errs.borrowerName = 'Borrower name is required';
    if (!form.dueDate) errs.dueDate = 'Due date is required';
    setErrors(errs);
    if (Object.keys(errs).length) {
      toast.error('Please fix the highlighted fields');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/library/loans/issue', {
        bookId: form.bookId,
        borrowerType: form.borrowerType,
        studentId: form.borrowerType === 'student' ? form.studentId : undefined,
        userId: form.borrowerType === 'staff' ? form.userId : undefined,
        borrowerName: form.borrowerType === 'other' ? form.borrowerName : undefined,
        borrowerId: form.borrowerType === 'other' ? form.borrowerId : undefined,
        dueDate: form.dueDate,
        notes: form.notes.trim() || undefined,
      });
      toast.success('Book issued');
      onSuccess();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to issue book');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = (field: string) => `input-field ${errors[field] ? 'border-red-500' : ''}`;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Book *</label>
        <select className={inputClass('bookId')} value={form.bookId} onChange={(e) => handleChange('bookId', e.target.value)}>
          <option value="">Select a book...</option>
          {books.map((b) => (
            <option key={b._id} value={b._id}>
              {b.title} — {b.availableCopies} available
            </option>
          ))}
        </select>
        {errors.bookId && <p className="text-red-500 text-xs mt-1">{errors.bookId}</p>}
      </div>

      <div>
        <label className="label">Borrower Type</label>
        <div className="flex gap-2">
          {(['student', 'staff', 'other'] as LibraryBorrowerType[]).map((type) => (
            <button
              key={type}
              type="button"
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                form.borrowerType === type
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
              onClick={() => handleChange('borrowerType', type)}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {form.borrowerType === 'student' && (
        <div>
          <label className="label">Student *</label>
          <div className="relative">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              className={inputClass('studentId')}
              placeholder="Search by name or admission number..."
              value={studentQuery}
              onChange={(e) => {
                setStudentQuery(e.target.value);
                handleChange('studentId', '');
              }}
            />
            {searching && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">Searching...</span>}
          </div>
          {studentResults.length > 0 && (
            <div className="mt-2 border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-200 dark:divide-gray-700 max-h-48 overflow-y-auto">
              {studentResults.map((s) => (
                <button
                  key={s._id}
                  type="button"
                  className={`w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                    form.studentId === s._id ? 'bg-primary-50 dark:bg-primary-900/30' : ''
                  }`}
                  onClick={() => {
                    handleChange('studentId', s._id);
                    setStudentQuery(`${s.name} (${s.admissionNumber})`);
                    setStudentResults([]);
                  }}
                >
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{s.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {s.admissionNumber} — {s.className || 'No class'}{s.streamName ? ` / ${s.streamName}` : ''}
                  </p>
                </button>
              ))}
            </div>
          )}
          {errors.studentId && <p className="text-red-500 text-xs mt-1">{errors.studentId}</p>}
        </div>
      )}

      {form.borrowerType === 'staff' && (
        <div>
          <label className="label">Staff Member *</label>
          <div className="relative">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              className={inputClass('userId')}
              placeholder="Search by name or email..."
              value={staffQuery}
              onChange={(e) => {
                setStaffQuery(e.target.value);
                handleChange('userId', '');
              }}
            />
            {searching && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">Searching...</span>}
          </div>
          {staffResults.length > 0 && (
            <div className="mt-2 border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-200 dark:divide-gray-700 max-h-48 overflow-y-auto">
              {staffResults.map((s) => (
                <button
                  key={s._id}
                  type="button"
                  className={`w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                    form.userId === s._id ? 'bg-primary-50 dark:bg-primary-900/30' : ''
                  }`}
                  onClick={() => {
                    handleChange('userId', s._id);
                    setStaffQuery(s.name);
                    setStaffResults([]);
                  }}
                >
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{s.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{s.email} — {s.role.replace(/_/g, ' ')}</p>
                </button>
              ))}
            </div>
          )}
          {errors.userId && <p className="text-red-500 text-xs mt-1">{errors.userId}</p>}
        </div>
      )}

      {form.borrowerType === 'other' && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Borrower Name *</label>
            <input
              className={inputClass('borrowerName')}
              value={form.borrowerName}
              onChange={(e) => handleChange('borrowerName', e.target.value)}
            />
            {errors.borrowerName && <p className="text-red-500 text-xs mt-1">{errors.borrowerName}</p>}
          </div>
          <div>
            <label className="label">ID Number</label>
            <input
              className="input-field"
              value={form.borrowerId}
              onChange={(e) => handleChange('borrowerId', e.target.value)}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Due Date *</label>
          <input
            type="date"
            className={inputClass('dueDate')}
            value={form.dueDate}
            onChange={(e) => handleChange('dueDate', e.target.value)}
          />
          {errors.dueDate && <p className="text-red-500 text-xs mt-1">{errors.dueDate}</p>}
        </div>
        <div>
          <label className="label">Notes</label>
          <input
            className="input-field"
            value={form.notes}
            onChange={(e) => handleChange('notes', e.target.value)}
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Issuing...' : 'Issue Book'}
        </button>
      </div>
    </form>
  );
}