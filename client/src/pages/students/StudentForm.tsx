import { useState, useEffect, type FormEvent, type ChangeEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../api/axios';
import type { Student, Class, Stream, StudentStatus, ApiResponse } from '../../types';
import { FaArrowLeft, FaCamera } from 'react-icons/fa';
import toast from 'react-hot-toast';

interface FormState {
  firstName: string;
  lastName: string;
  gender: 'male' | 'female';
  dateOfBirth: string;
  admissionNumber: string;
  email: string;
  password: string;
  class: string;
  stream: string;
  guardianName: string;
  guardianPhone: string;
  guardianEmail: string;
  guardianRelationship: string;
  guardianAddress: string;
  address: string;
  emergencyContact: string;
  medicalInfo: string;
  previousSchool: string;
  enrollmentDate: string;
  status: StudentStatus;
  totalFee: string;
  amountPaid: string;
}

const initialForm: FormState = {
  firstName: '',
  lastName: '',
  gender: 'male',
  dateOfBirth: '',
  admissionNumber: '',
  email: '',
  password: '',
  class: '',
  stream: '',
  guardianName: '',
  guardianPhone: '',
  guardianEmail: '',
  guardianRelationship: 'father',
  guardianAddress: '',
  address: '',
  emergencyContact: '',
  medicalInfo: '',
  previousSchool: '',
  enrollmentDate: new Date().toISOString().split('T')[0],
  status: 'active',
  totalFee: '',
  amountPaid: '',
};

const relationshipOptions = [
  { value: 'father', label: 'Father' },
  { value: 'mother', label: 'Mother' },
  { value: 'guardian', label: 'Guardian' },
  { value: 'other', label: 'Other' },
];

const statusOptions: { value: StudentStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'graduated', label: 'Graduated' },
  { value: 'transferred', label: 'Transferred' },
  { value: 'archived', label: 'Archived' },
];

export default function StudentForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const studentId = searchParams.get('id');
  const isEdit = !!studentId;

  const [form, setForm] = useState<FormState>(initialForm);
  const [classes, setClasses] = useState<Class[]>([]);
  const [streams, setStreams] = useState<Stream[]>([]);
  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [createdCreds, setCreatedCreds] = useState<{ email: string; password: string } | null>(null);

  const selectedClass = classes.find((c) => c._id === form.class);

  useEffect(() => {
    const init = async () => {
      try {
        const classRes = await api.get<ApiResponse<Class[]>>('/classes');
        setClasses(classRes.data.data || []);
      } catch {
        toast.error('Failed to load classes');
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    const fetchStudent = async () => {
      try {
        const { data } = await api.get<ApiResponse<{ student: Student }>>(`/students/${studentId}`);
        const s = data.data?.student;
        if (!s) {
          toast.error('Student not found');
          setLoading(false);
          return;
        }
        setForm({
          firstName: s.firstName,
          lastName: s.lastName,
          gender: s.gender,
          dateOfBirth: s.dateOfBirth?.split('T')[0] || '',
          admissionNumber: s.admissionNumber,
          email: (s as any).user?.email || (s as any).email || '',
          password: '',
          class: typeof s.class === 'object' ? (s.class as any)._id : s.class,
          stream: typeof s.stream === 'object' ? (s.stream as any)?._id || '' : s.stream || '',
          guardianName: s.guardianInfo?.name || '',
          guardianPhone: s.guardianInfo?.phone || '',
          guardianEmail: s.guardianInfo?.email || '',
          guardianRelationship: s.guardianInfo?.relationship || '',
          guardianAddress: s.guardianInfo?.address || '',
          address: typeof s.address === 'string' ? s.address : '',
          emergencyContact: typeof s.emergencyContact === 'string' ? s.emergencyContact : '',
          medicalInfo: typeof s.medicalInfo === 'string' ? s.medicalInfo : '',
          previousSchool: s.previousSchool || '',
          enrollmentDate: s.enrollmentDate?.split('T')[0] || '',
          status: s.status,
          totalFee: s.schoolFees?.totalFee?.toString() || '',
          amountPaid: s.schoolFees?.amountPaid?.toString() || '',
        });
        if (s.passportPhoto) {
          setPhotoPreview(s.passportPhoto);
        }
      } catch {
        toast.error('Failed to load student data');
      } finally {
        setLoading(false);
      }
    };
    fetchStudent();
  }, [isEdit, studentId]);

  useEffect(() => {
    if (!photoFile) return;
    const reader = new FileReader();
    reader.onload = (e) => setPhotoPreview(e.target?.result as string);
    reader.readAsDataURL(photoFile);
  }, [photoFile]);

  useEffect(() => {
    if (!form.class) {
      setStreams([]);
      return;
    }
    const ids = selectedClass?.streams?.map((s) => (typeof s === 'object' ? (s as any)._id : s)).filter(Boolean);
    if (!ids?.length) {
      setStreams([]);
      return;
    }
    api
      .get<ApiResponse<Stream[]>>('/streams', { params: { ids: ids.join(',') } })
      .then((res) => setStreams(res.data.data || []))
      .catch(() => setStreams([]));
  }, [form.class]);

  const handleChange = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handlePhotoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file');
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        toast.error('Image must be less than 2MB');
        return;
      }
      setPhotoFile(file);
    }
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.firstName.trim()) errs.firstName = 'First name is required';
    if (!form.lastName.trim()) errs.lastName = 'Last name is required';
    if (!form.admissionNumber.trim()) errs.admissionNumber = 'Admission number is required';
    if (!form.class) errs.class = 'Class is required';
    if (!form.guardianName.trim()) errs.guardianName = 'Guardian name is required';
    if (!form.guardianPhone.trim()) errs.guardianPhone = 'Guardian phone is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      const payload: Record<string, any> = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        gender: form.gender,
        dateOfBirth: form.dateOfBirth || undefined,
        admissionNumber: form.admissionNumber.trim(),
        email: form.email.trim() || undefined,
        password: form.password || undefined,
        class: form.class,
        stream: form.stream || undefined,
        guardianInfo: {
          name: form.guardianName.trim(),
          phone: form.guardianPhone.trim(),
          relationship: form.guardianRelationship,
          email: form.guardianEmail.trim() || undefined,
          address: form.guardianAddress.trim() || undefined,
        },
        address: form.address.trim() || undefined,
        emergencyContact: form.emergencyContact.trim() || undefined,
        medicalInfo: form.medicalInfo.trim() || undefined,
        previousSchool: form.previousSchool.trim() || undefined,
        enrollmentDate: form.enrollmentDate || undefined,
        status: form.status,
        schoolFees: {
          totalFee: parseFloat(form.totalFee) || 0,
          amountPaid: parseFloat(form.amountPaid) || 0,
        },
      };

      if (isEdit) {
        await api.put(`/students/${studentId}`, payload);
        if (photoFile) {
          const photoFormData = new FormData();
          photoFormData.append('passportPhoto', photoFile);
          await api.post(`/students/${studentId}/photo`, photoFormData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        }
        toast.success('Student updated successfully');
        navigate('/students');
      } else {
        const { data: createRes } = await api.post('/students', payload);
        if (photoFile) {
          const photoFormData = new FormData();
          photoFormData.append('passportPhoto', photoFile);
          await api.post(`/students/${createRes.data._id}/photo`, photoFormData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        }
        if (createRes.credentials) {
          setCreatedCreds(createRes.credentials);
        } else {
          toast.success('Student created successfully');
          navigate('/students');
        }
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to save student';
      if (err.response?.data?.errors) {
        const serverErrors: Record<string, string> = {};
        if (Array.isArray(err.response.data.errors)) {
          err.response.data.errors.forEach((e: any) => {
            if (e.field) serverErrors[e.field] = e.message;
          });
        }
        setErrors(serverErrors);
      }
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/students')} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
            <FaArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="page-title">{isEdit ? 'Edit Student' : 'Add New Student'}</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Personal Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">First Name *</label>
              <input
                className={`input-field ${errors.firstName ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                value={form.firstName}
                onChange={(e) => handleChange('firstName', e.target.value)}
              />
              {errors.firstName && <p className="mt-1 text-xs text-red-600">{errors.firstName}</p>}
            </div>
            <div>
              <label className="label">Last Name *</label>
              <input
                className={`input-field ${errors.lastName ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                value={form.lastName}
                onChange={(e) => handleChange('lastName', e.target.value)}
              />
              {errors.lastName && <p className="mt-1 text-xs text-red-600">{errors.lastName}</p>}
            </div>
            <div>
              <label className="label">Gender *</label>
              <select className="input-field" value={form.gender} onChange={(e) => handleChange('gender', e.target.value)}>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
            <div>
              <label className="label">Date of Birth</label>
              <input type="date" className="input-field" value={form.dateOfBirth} onChange={(e) => handleChange('dateOfBirth', e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <label className="label">Passport Photo</label>
              <div className="flex items-center gap-4">
                <div className="relative w-24 h-24 rounded-xl overflow-hidden border-2 border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                  {photoPreview ? (
                    <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <FaCamera className="w-8 h-8 text-gray-400" />
                  )}
                </div>
                <div>
                  <label className="btn-secondary cursor-pointer">
                    <FaCamera className="w-4 h-4 mr-1" />
                    {photoPreview ? 'Change Photo' : 'Upload Photo'}
                    <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                  </label>
                  <p className="mt-1 text-xs text-gray-500">PNG, JPG up to 2MB</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Academic Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Class *</label>
              <select
                className={`input-field ${errors.class ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                value={form.class}
                onChange={(e) => { handleChange('class', e.target.value); handleChange('stream', ''); }}
              >
                <option value="">Select class</option>
                {classes.map((c) => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
              {errors.class && <p className="mt-1 text-xs text-red-600">{errors.class}</p>}
            </div>
            <div>
              <label className="label">Stream</label>
              <select
                className="input-field"
                value={form.stream}
                onChange={(e) => handleChange('stream', e.target.value)}
                disabled={!form.class}
              >
                <option value="">Select stream</option>
                {streams.map((s) => (
                  <option key={s._id} value={s._id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Admission Number *</label>
              <input
                className={`input-field ${errors.admissionNumber ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                value={form.admissionNumber}
                onChange={(e) => handleChange('admissionNumber', e.target.value)}
                placeholder="e.g. STU-2026-001"
              />
              {errors.admissionNumber && <p className="mt-1 text-xs text-red-600">{errors.admissionNumber}</p>}
            </div>
            <div>
              <label className="label">Login Email <span className="text-gray-400 font-normal">(optional)</span></label>
              <input type="email" className="input-field" value={form.email} onChange={(e) => handleChange('email', e.target.value)} placeholder="For student portal access" />
            </div>
            <div>
              <label className="label">Login Password <span className="text-gray-400 font-normal">(optional)</span></label>
              <input type="password" className="input-field" value={form.password} onChange={(e) => handleChange('password', e.target.value)} placeholder="Defaults to student123" />
            </div>
            <div>
              <label className="label">Enrollment Date</label>
              <input type="date" className="input-field" value={form.enrollmentDate} onChange={(e) => handleChange('enrollmentDate', e.target.value)} />
            </div>
            <div>
              <label className="label">Previous School</label>
              <input className="input-field" value={form.previousSchool} onChange={(e) => handleChange('previousSchool', e.target.value)} placeholder="Previous school name" />
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input-field" value={form.status} onChange={(e) => handleChange('status', e.target.value)}>
                {statusOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">School Fees</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Total Fee</label>
              <input type="number" className="input-field" value={form.totalFee} onChange={(e) => handleChange('totalFee', e.target.value)} placeholder="0" min="0" />
            </div>
            <div>
              <label className="label">Amount Paid</label>
              <input type="number" className="input-field" value={form.amountPaid} onChange={(e) => handleChange('amountPaid', e.target.value)} placeholder="0" min="0" />
            </div>
            {form.totalFee && (
              <div className="md:col-span-2">
                <label className="label">Balance</label>
                <p className={`text-lg font-semibold ${(parseFloat(form.totalFee) - parseFloat(form.amountPaid || '0')) <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {(parseFloat(form.totalFee) - parseFloat(form.amountPaid || '0')) <= 0
                    ? 'Fully Paid'
                    : `Balance: ${(parseFloat(form.totalFee) - parseFloat(form.amountPaid || '0')).toLocaleString()}`}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Guardian Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Guardian Name *</label>
              <input
                className={`input-field ${errors.guardianName ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                value={form.guardianName}
                onChange={(e) => handleChange('guardianName', e.target.value)}
              />
              {errors.guardianName && <p className="mt-1 text-xs text-red-600">{errors.guardianName}</p>}
            </div>
            <div>
              <label className="label">Guardian Phone *</label>
              <input
                className={`input-field ${errors.guardianPhone ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                value={form.guardianPhone}
                onChange={(e) => handleChange('guardianPhone', e.target.value)}
              />
              {errors.guardianPhone && <p className="mt-1 text-xs text-red-600">{errors.guardianPhone}</p>}
            </div>
            <div>
              <label className="label">Guardian Email</label>
              <input type="email" className="input-field" value={form.guardianEmail} onChange={(e) => handleChange('guardianEmail', e.target.value)} />
            </div>
            <div>
              <label className="label">Relationship</label>
              <select className="input-field" value={form.guardianRelationship} onChange={(e) => handleChange('guardianRelationship', e.target.value)}>
                {relationshipOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="label">Guardian Address</label>
              <input className="input-field" value={form.guardianAddress} onChange={(e) => handleChange('guardianAddress', e.target.value)} />
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Additional Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Address</label>
              <input className="input-field" value={form.address} onChange={(e) => handleChange('address', e.target.value)} />
            </div>
            <div>
              <label className="label">Emergency Contact</label>
              <input className="input-field" value={form.emergencyContact} onChange={(e) => handleChange('emergencyContact', e.target.value)} placeholder="Phone number" />
            </div>
            <div className="md:col-span-2">
              <label className="label">Medical Info</label>
              <textarea className="input-field" rows={3} value={form.medicalInfo} onChange={(e) => handleChange('medicalInfo', e.target.value)} placeholder="Allergies, conditions, medications..." />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={() => navigate('/students')}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </span>
            ) : (
              isEdit ? 'Update Student' : 'Create Student'
            )}
          </button>
        </div>
      </form>

      {createdCreds && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Student Created</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Share these credentials with the student. This is the only time they'll be shown.
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
              onClick={() => { setCreatedCreds(null); navigate('/students'); }}
            >
              I've Saved the Credentials
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
