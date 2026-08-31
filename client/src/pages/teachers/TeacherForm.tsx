import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../api/axios';
import type { Subject, Class as ClassType, TeacherDesignation } from '../../types';
import { DESIGNATION_LABELS } from '../../types';
import { FaArrowLeft, FaCrown } from 'react-icons/fa';
import toast from 'react-hot-toast';

const defaultForm = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  employeeId: '',
  password: '',
  confirmPassword: '',
  dateOfEmployment: new Date().toISOString().split('T')[0],
  qualifications: '',
  subjects: [] as string[],
  classAssigned: '',
  isClassTeacher: false,
  designation: 'teacher' as TeacherDesignation,
  role: 'teacher',
  address: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  emergencyContactRelationship: '',
};

export default function TeacherForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const id = searchParams.get('id');
  const isEdit = !!id;

  const [form, setForm] = useState({ ...defaultForm });

  const isLibrarianRole = form.role === 'librarian';

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<ClassType[]>([]);
  const [loading, setLoading] = useState(!!id);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [createdCreds, setCreatedCreds] = useState<{ email: string; password: string } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [subjectsRes, classesRes] = await Promise.all([
          api.get('/subjects'),
          api.get('/classes'),
        ]);
        setSubjects(subjectsRes.data.data || []);
        setClasses(classesRes.data.data || []);

        if (id) {
          const { data } = await api.get(`/teachers/${id}`);
          const t = data.data?.teacher;
          if (!t) {
            toast.error('Teacher not found');
            setLoading(false);
            return;
          }
          setForm({
            ...defaultForm,
            firstName: t.firstName || '',
            lastName: t.lastName || '',
            email: (typeof t.user === 'object' && t.user?.email) || '',
            phone: (typeof t.user === 'object' && t.user?.phone) || '',
            employeeId: t.employeeId || '',
            dateOfEmployment:
              t.dateOfEmployment?.split('T')[0] || defaultForm.dateOfEmployment,
            qualifications: Array.isArray(t.qualifications) ? '' : (t.qualifications || ''),
            subjects: (t.subjects || []).map((s: any) => (typeof s === 'object' ? s._id : s)),
            classAssigned:
              typeof t.classAssigned === 'object'
                ? (t.classAssigned as any)._id || ''
                : t.classAssigned || '',
            isClassTeacher: t.isClassTeacher || false,
            designation: t.designation || 'teacher',
            role: (typeof t.user === 'object' && t.user?.role) || 'teacher',
            address: typeof t.address === 'object' && t.address ? t.address.street || '' : (t.address || ''),
            emergencyContactName: t.emergencyContact?.name || '',
            emergencyContactPhone: t.emergencyContact?.phone || '',
            emergencyContactRelationship:
              t.emergencyContact?.relationship || '',
          });
        }
      } catch {
        toast.error('Failed to load data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

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

  const toggleSubject = (subjectId: string) => {
    setForm((prev) => ({
      ...prev,
      subjects: prev.subjects.includes(subjectId)
        ? prev.subjects.filter((s) => s !== subjectId)
        : [...prev.subjects, subjectId],
    }));
  };

  const validate = (): Record<string, string> | null => {
    const errs: Record<string, string> = {};
    if (!form.firstName.trim()) errs.firstName = 'First name is required';
    if (!form.lastName.trim()) errs.lastName = 'Last name is required';
    if (!isLibrarianRole && !form.employeeId.trim()) errs.employeeId = 'Employee ID is required';
    if (!form.email.trim()) errs.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      errs.email = 'Invalid email format';
    if (!isEdit) {
      if (!form.password) errs.password = 'Password is required';
      else if (form.password.length < 6) errs.password = 'Password must be at least 6 characters';
      else if (form.password !== form.confirmPassword) errs.confirmPassword = 'Passwords do not match';
    }
    setErrors(errs);
    return Object.keys(errs).length ? errs : null;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (errs) {
      const fieldList = Object.keys(errs).join(', ');
      toast.error(`Please fix: ${fieldList}`);
      const firstField = document.querySelector(`[name="${Object.keys(errs)[0]}"]`);
      firstField?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      (firstField as HTMLElement)?.focus();
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        employeeId: form.employeeId.trim(),
        dateOfEmployment: form.dateOfEmployment || undefined,
        qualifications: form.qualifications.trim() || undefined,
        subjects: form.subjects,
        classAssigned: form.classAssigned || undefined,
        isClassTeacher: form.isClassTeacher,
        designation: form.designation,
        role: form.role,
        address: form.address.trim() || undefined,
        emergencyContact: {
          name: form.emergencyContactName.trim() || undefined,
          phone: form.emergencyContactPhone.trim() || undefined,
          relationship: form.emergencyContactRelationship.trim() || undefined,
        },
      };

      if (isEdit) {
        await api.put(`/teachers/${id}`, payload);
        toast.success('Teacher updated');
        navigate('/teachers');
      } else {
        (payload as any).password = form.password;
        const { data: resData } = await api.post('/teachers', payload);
        if (resData.credentials) {
          setCreatedCreds(resData.credentials);
        } else {
          toast.success('Teacher created');
          navigate('/teachers');
        }
      }
    } catch (err: any) {
      toast.error(
        err.response?.data?.message || 'Failed to save teacher'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/teachers')}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          >
            <FaArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="page-title">
            {isEdit ? 'Edit Teacher' : 'Add New Teacher'}
          </h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Personal Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">First Name *</label>
              <input
                name="firstName"
                className={`input-field ${errors.firstName ? 'border-red-500' : ''}`}
                value={form.firstName}
                onChange={(e) => handleChange('firstName', e.target.value)}
              />
              {errors.firstName && (
                <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>
              )}
            </div>
            <div>
              <label className="label">Last Name *</label>
              <input
                name="lastName"
                className={`input-field ${errors.lastName ? 'border-red-500' : ''}`}
                value={form.lastName}
                onChange={(e) => handleChange('lastName', e.target.value)}
              />
              {errors.lastName && (
                <p className="text-red-500 text-xs mt-1">{errors.lastName}</p>
              )}
            </div>
            <div>
              <label className="label">Email *</label>
              <input
                name="email"
                type="email"
                className={`input-field ${errors.email ? 'border-red-500' : ''}`}
                value={form.email}
                onChange={(e) => handleChange('email', e.target.value)}
              />
              {errors.email && (
                <p className="text-red-500 text-xs mt-1">{errors.email}</p>
              )}
            </div>
            <div>
              <label className="label">Phone</label>
              <input
                className="input-field"
                value={form.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
              />
            </div>
          </div>
          {!isEdit && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div>
                <label className="label">Password *</label>
                <input
                  name="password"
                  type="password"
                  className={`input-field ${errors.password ? 'border-red-500' : ''}`}
                  value={form.password}
                  onChange={(e) => handleChange('password', e.target.value)}
                />
                {errors.password && (
                  <p className="text-red-500 text-xs mt-1">{errors.password}</p>
                )}
              </div>
              <div>
                <label className="label">Confirm Password *</label>
                <input
                  name="confirmPassword"
                  type="password"
                  className={`input-field ${errors.confirmPassword ? 'border-red-500' : ''}`}
                  value={form.confirmPassword}
                  onChange={(e) => handleChange('confirmPassword', e.target.value)}
                />
                {errors.confirmPassword && (
                  <p className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Employment Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Employee ID *</label>
              <input
                name="employeeId"
                className={`input-field ${errors.employeeId ? 'border-red-500' : ''}`}
                value={form.employeeId}
                onChange={(e) => handleChange('employeeId', e.target.value)}
              />
              {errors.employeeId && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.employeeId}
                </p>
              )}
            </div>
            <div>
              <label className="label">Date of Employment</label>
              <input
                type="date"
                className="input-field"
                value={form.dateOfEmployment}
                onChange={(e) => handleChange('dateOfEmployment', e.target.value)}
              />
            </div>
            <div>
              <label className="label">Designation</label>
              {isLibrarianRole ? (
                <p className="text-sm text-gray-400 dark:text-gray-500 py-2.5">Not applicable for librarian accounts</p>
              ) : (
                <select className="input-field" value={form.designation} onChange={(e) => handleChange('designation', e.target.value)}>
                  {(Object.entries(DESIGNATION_LABELS) as [TeacherDesignation, string][]).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className="label">System Role</label>
              <select className="input-field" value={form.role} onChange={(e) => handleChange('role', e.target.value)}>
                <option value="headteacher" disabled>Headteacher</option>
                <option value="teacher">Teacher (generic)</option>
                <option value="class_teacher">Class Teacher</option>
                <option value="subject_teacher">Subject Teacher</option>
                <option value="academic_teacher">Academic Teacher</option>
                <option value="librarian">Librarian (non-teaching)</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {isLibrarianRole
                  ? 'Librarian accounts get a dedicated Library section for managing books and loans'
                  : 'Controls what sections the teacher can access'}
              </p>
            </div>
            <div className="md:col-span-2">
              <label className="label">Qualifications</label>
              <textarea
                className="input-field"
                rows={3}
                value={form.qualifications}
                onChange={(e) => handleChange('qualifications', e.target.value)}
                placeholder="List academic degrees, certifications, and relevant experience..."
              />
            </div>
          </div>
        </div>

        {!isLibrarianRole && (
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Assignment
            </h2>
            <div className="space-y-4">
            <div>
              <label className="label">Subjects</label>
              <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-2 border border-gray-200 dark:border-gray-700 rounded-lg">
                {subjects.length === 0 ? (
                  <p className="text-sm text-gray-400 w-full text-center py-2">
                    No subjects available
                  </p>
                ) : (
                  subjects.map((subject) => (
                    <button
                      key={subject._id}
                      type="button"
                      onClick={() => toggleSubject(subject._id)}
                      className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                        form.subjects.includes(subject._id)
                          ? 'bg-primary-100 text-primary-700 border-primary-300 dark:bg-primary-900/50 dark:text-primary-300'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600'
                      }`}
                    >
                      {subject.name}
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Assigned Class</label>
                <select
                  className="input-field"
                  value={form.classAssigned}
                  onChange={(e) => handleChange('classAssigned', e.target.value)}
                >
                  <option value="">Not assigned</option>
                  {classes.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isClassTeacher}
                    onChange={(e) =>
                      handleChange('isClassTeacher', e.target.checked)
                    }
                    className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Class Teacher
                  </span>
                </label>
              </div>
            </div>
          </div>
        </div>
        )}

        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Address & Emergency Contact
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="label">Address</label>
              <input
                className="input-field"
                value={form.address}
                onChange={(e) => handleChange('address', e.target.value)}
                placeholder="Physical address / residence"
              />
            </div>
            <div>
              <label className="label">Emergency Contact Name</label>
              <input
                className="input-field"
                value={form.emergencyContactName}
                onChange={(e) =>
                  handleChange('emergencyContactName', e.target.value)
                }
              />
            </div>
            <div>
              <label className="label">Emergency Contact Phone</label>
              <input
                className="input-field"
                value={form.emergencyContactPhone}
                onChange={(e) =>
                  handleChange('emergencyContactPhone', e.target.value)
                }
              />
            </div>
            <div>
              <label className="label">Relationship</label>
              <select
                className="input-field"
                value={form.emergencyContactRelationship}
                onChange={(e) =>
                  handleChange(
                    'emergencyContactRelationship',
                    e.target.value
                  )
                }
              >
                <option value="">Select relationship</option>
                <option value="spouse">Spouse</option>
                <option value="parent">Parent</option>
                <option value="sibling">Sibling</option>
                <option value="friend">Friend</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => navigate('/teachers')}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={submitting}
          >
            {submitting
              ? 'Saving...'
              : isEdit
              ? 'Update Teacher'
              : isLibrarianRole
              ? 'Create Librarian Account'
              : 'Create Teacher'}
          </button>
        </div>
      </form>

      {createdCreds && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              {isLibrarianRole ? 'Librarian Account Created' : 'Teacher Created'}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Share these credentials with the {isLibrarianRole ? 'librarian' : 'teacher'}. This is the only time they'll be shown.
            </p>
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4 mb-6 text-left space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Email</label>
                <p className="text-sm font-semibold text-gray-900 dark:text-white font-mono">{createdCreds.email}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Password</label>
                <p className="text-sm font-semibold text-gray-900 dark:text-white font-mono">{createdCreds.password}</p>
              </div>
            </div>
            <button
              className="btn-primary w-full"
              onClick={() => {
                setCreatedCreds(null);
                if (isLibrarianRole) {
                  navigate('/library');
                } else {
                  navigate('/teachers');
                }
              }}
            >
              {isLibrarianRole ? "I've Saved the Credentials — Go to Library" : "I've Saved the Credentials"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
