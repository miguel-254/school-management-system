import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { FaPlus, FaTimes } from 'react-icons/fa';
import type { AcademicYear, Teacher, Subject, Stream } from '../../types';
import { useAuth } from '../../context/AuthContext';

interface StreamInput {
  name: string;
  code: string;
}

export default function ClassForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const isEdit = location.pathname.includes('/edit');
  const { isHeadteacher } = useAuth();

  const [form, setForm] = useState({
    name: '',
    code: '',
    description: '',
    department: '',
    academicYear: '',
    classTeacher: '',
    capacity: '' as string | number,
    streams: [] as StreamInput[],
    subjects: [] as string[],
  });
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [allSubjects, setAllSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [teachersRes, subjectsRes] = await Promise.all([
          api.get('/teachers', { params: { limit: 100 } }).catch(() => ({ data: { data: [] } })),
          api.get('/subjects', { params: { limit: 200 } }).catch(() => ({ data: { data: [] } })),
        ]);
        setTeachers(teachersRes.data.data?.teachers || teachersRes.data.data || []);
        setAllSubjects(subjectsRes.data.data || []);
        api.get('/academic-years', { params: { limit: 50 } })
          .then((res) => setAcademicYears(res.data.data || []))
          .catch(() => {});

        if (isEdit && id) {
          const { data } = await api.get(`/classes/${id}`);
          const cls = data.data;
          setForm({
            name: cls.name || '',
            code: cls.code || '',
            description: cls.description || '',
            department: cls.department || '',
            academicYear: typeof cls.academicYear === 'object' ? cls.academicYear._id : (cls.academicYear || ''),
            classTeacher: typeof cls.classTeacher === 'object' ? cls.classTeacher._id : (cls.classTeacher || ''),
            capacity: cls.capacity ?? '',
            streams: (cls.streams || []).map((s: Stream | string) => {
              if (typeof s === 'object') return { name: (s as Stream).name, code: (s as Stream).code };
              return { name: s, code: '' };
            }),
            subjects: (cls.subjects || []).map((s: Subject | string) => (typeof s === 'object' ? s._id : s)),
          });
        }
      } catch (err: any) {
        toast.error('Failed to load form data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, isEdit]);

  const handleChange = (field: string, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy[field];
        return copy;
      });
    }
  };

  const addStream = () => {
    setForm((prev) => ({ ...prev, streams: [...prev.streams, { name: '', code: '' }] }));
  };

  const updateStream = (index: number, field: 'name' | 'code', value: string) => {
    const streams = [...form.streams];
    streams[index] = { ...streams[index], [field]: value };
    setForm((prev) => ({ ...prev, streams }));
  };

  const removeStream = (index: number) => {
    setForm((prev) => ({
      ...prev,
      streams: prev.streams.filter((_, i) => i !== index),
    }));
  };

  const toggleSubject = (subjectId: string) => {
    setForm((prev) => ({
      ...prev,
      subjects: prev.subjects.includes(subjectId)
        ? prev.subjects.filter((s) => s !== subjectId)
        : [...prev.subjects, subjectId],
    }));
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    if (!form.code.trim()) errs.code = 'Code is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim(),
        description: form.description.trim() || undefined,
        department: form.department.trim() || undefined,
        academicYear: form.academicYear || undefined,
        classTeacher: form.classTeacher || undefined,
        capacity: form.capacity !== '' ? Number(form.capacity) : undefined,
        streams: form.streams
          .filter((s) => s.name.trim())
          .map((s) => ({ name: s.name.trim(), code: s.code.trim() || undefined })),
        subjects: form.subjects,
      };

      if (isEdit && id) {
        await api.put(`/classes/${id}`, payload);
        toast.success('Class updated');
      } else {
        await api.post('/classes', payload);
        toast.success('Class created');
      }
      navigate('/classes');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save class');
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
        <h1 className="page-title">{isEdit ? 'Edit Class' : 'Add New Class'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Class Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Name *</label>
              <input
                className={`input-field ${errors.name ? 'border-red-500' : ''}`}
                value={form.name}
                onChange={(e) => handleChange('name', e.target.value)}
              />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
            </div>
            <div>
              <label className="label">Code *</label>
              <input
                className={`input-field ${errors.code ? 'border-red-500' : ''}`}
                value={form.code}
                onChange={(e) => handleChange('code', e.target.value)}
              />
              {errors.code && <p className="text-red-500 text-xs mt-1">{errors.code}</p>}
            </div>
            <div className="md:col-span-2">
              <label className="label">Description</label>
              <textarea
                className="input-field"
                rows={2}
                value={form.description}
                onChange={(e) => handleChange('description', e.target.value)}
              />
            </div>
            <div>
              <label className="label">Department</label>
              <input
                className="input-field"
                value={form.department}
                onChange={(e) => handleChange('department', e.target.value)}
              />
            </div>
            <div>
              <label className="label">Capacity</label>
              <input
                type="number"
                min={0}
                className="input-field"
                value={form.capacity}
                onChange={(e) => handleChange('capacity', e.target.value === '' ? '' : parseInt(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="label">Academic Year</label>
              <select
                className="input-field"
                value={form.academicYear}
                onChange={(e) => handleChange('academicYear', e.target.value)}
              >
                <option value="">Select academic year</option>
                {academicYears.map((y) => (
                  <option key={y._id} value={y._id}>
                    {y.name} ({y.year}){y.isCurrent ? ' (Current)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Class Teacher</label>
              <select
                className="input-field"
                value={form.classTeacher}
                onChange={(e) => handleChange('classTeacher', e.target.value)}
              >
                <option value="">Select teacher</option>
                {teachers.map((t) => (
                  <option key={t._id} value={t._id}>{t.fullName}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Streams</h2>
            <button type="button" className="btn-secondary text-xs" onClick={addStream}>
              <FaPlus className="w-3 h-3 mr-1" />
              Add Stream
            </button>
          </div>
          {form.streams.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 italic">No streams added yet.</p>
          ) : (
            <div className="space-y-2">
              {form.streams.map((stream, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    className="input-field flex-1"
                    placeholder={`Stream ${index + 1} name`}
                    value={stream.name}
                    onChange={(e) => updateStream(index, 'name', e.target.value)}
                  />
                  <input
                    className="input-field w-32"
                    placeholder="Code"
                    value={stream.code}
                    onChange={(e) => updateStream(index, 'code', e.target.value)}
                  />
                  <button
                    type="button"
                    className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                    onClick={() => removeStream(index)}
                    title="Remove stream"
                  >
                    <FaTimes className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Subjects</h2>
          {allSubjects.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 italic">No subjects available.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {allSubjects.map((subject) => {
                const selected = form.subjects.includes(subject._id);
                return (
                  <button
                    key={subject._id}
                    type="button"
                    onClick={() => toggleSubject(subject._id)}
                    className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                      selected
                        ? 'bg-primary-100 text-primary-700 border-primary-300 dark:bg-primary-900/50 dark:text-primary-300 dark:border-primary-700'
                        : 'bg-gray-50 text-gray-600 border-gray-300 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-700'
                    }`}
                  >
                    {subject.name}
                    {selected && <span className="ml-1.5 text-xs opacity-70">✓</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={() => navigate('/classes')}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Saving...' : isEdit ? 'Update Class' : 'Create Class'}
          </button>
        </div>
      </form>
    </div>
  );
}
