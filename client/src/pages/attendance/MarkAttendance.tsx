import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import type { Student, Class, Subject, Stream, AcademicYear, Term, AttendanceStatus, ApiResponse } from '../../types';
import { FaCheckCircle, FaUsers, FaChevronLeft, FaChevronRight, FaUserCheck, FaUserTimes, FaSave } from 'react-icons/fa';

interface StudentRecord {
  studentId: string;
  name: string;
  admissionNumber: string;
  status: AttendanceStatus;
  remarks: string;
}

const statusOptions: { value: AttendanceStatus; label: string; color: string }[] = [
  { value: 'present', label: 'Present', color: 'text-green-600 dark:text-green-400 border-green-300 dark:border-green-700' },
  { value: 'absent', label: 'Absent', color: 'text-red-600 dark:text-red-400 border-red-300 dark:border-red-700' },
  { value: 'excused', label: 'Excused', color: 'text-yellow-600 dark:text-yellow-400 border-yellow-300 dark:border-yellow-700' },
  { value: 'sick', label: 'Sick', color: 'text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-700' },
  { value: 'schoolActivity', label: 'School Activity', color: 'text-purple-600 dark:text-purple-400 border-purple-300 dark:border-purple-700' },
];

export default function MarkAttendance() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [streams, setStreams] = useState<Stream[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);

  const [form, setForm] = useState({
    classId: '',
    streamId: '',
    subjectId: '',
    date: new Date().toISOString().split('T')[0],
    academicYearId: '',
    termId: '',
  });

  const [records, setRecords] = useState<StudentRecord[]>([]);

  const fetchMeta = useCallback(async () => {
    try {
      const [classesRes, subjectsRes, yearsRes, termsRes] = await Promise.all([
        api.get<ApiResponse<Class[]>>('/classes'),
        api.get<ApiResponse<Subject[]>>('/subjects'),
        api.get<ApiResponse<AcademicYear[]>>('/academic-years'),
        api.get<ApiResponse<Term[]>>('/terms'),
      ]);
      setClasses(classesRes.data.data || []);
      setSubjects(subjectsRes.data.data || []);
      const years = yearsRes.data.data || [];
      setAcademicYears(years);
      const currentYear = years.find((y) => y.isCurrent);
      if (currentYear) {
        setForm((p) => ({ ...p, academicYearId: currentYear._id }));
      }
      const allTerms = termsRes.data.data || [];
      setTerms(allTerms);
      const currentTerm = allTerms.find((t) => t.isCurrent);
      if (currentTerm) {
        setForm((p) => ({ ...p, termId: currentTerm._id }));
      }
    } catch {
      toast.error('Failed to load metadata');
    }
  }, []);

  useEffect(() => {
    fetchMeta();
  }, [fetchMeta]);

  useEffect(() => {
    if (form.classId) {
      const cls = classes.find((c) => c._id === form.classId);
      const strms = cls?.streams?.filter((s): s is Stream => typeof s === 'object') || [];
      setStreams(strms);
    } else {
      setStreams([]);
    }
  }, [form.classId, classes]);

  const filteredTerms = form.academicYearId
    ? terms.filter((t) => {
        const tYear = typeof t.academicYear === 'object' ? t.academicYear._id : t.academicYear;
        return tYear === form.academicYearId;
      })
    : terms;

  const fetchStudents = async () => {
    if (!form.classId || !form.subjectId) {
      toast.error('Please select class and subject');
      return;
    }
    setLoading(true);
    try {
      const params: Record<string, string> = { class: form.classId, subject: form.subjectId };
      if (form.streamId) params.stream = form.streamId;
      const { data } = await api.get('/students', { params });
      const studentList = (data.data?.students || data.data || []) as Student[];
      setStudents(studentList);
      setRecords(
        studentList.map((s) => ({
          studentId: s._id,
          name: s.fullName,
          admissionNumber: s.admissionNumber,
          status: 'present' as AttendanceStatus,
          remarks: '',
        }))
      );
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  const markAll = (status: AttendanceStatus) => {
    setRecords((prev) => prev.map((r) => ({ ...r, status })));
  };

  const updateRecord = (studentId: string, field: 'status' | 'remarks', value: string) => {
    setRecords((prev) =>
      prev.map((r) => (r.studentId === studentId ? { ...r, [field]: value } : r))
    );
  };

  const handleSubmit = async () => {
    if (records.length === 0) {
      toast.error('No students to mark');
      return;
    }

    const missing = records.filter((r) => !r.status);
    if (missing.length > 0) {
      toast.error(`Please mark status for all students (${missing.length} remaining)`);
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await api.post('/attendance/bulk', {
        class: form.classId,
        subject: form.subjectId,
        streamId: form.streamId || undefined,
        date: form.date,
        academicYear: form.academicYearId || undefined,
        term: form.termId || undefined,
        records: records.map((r) => ({
          student: r.studentId,
          status: r.status,
          remarks: r.remarks || undefined,
        })),
      });
      const result = data?.data || {};
      const created = result.created ?? 0;
      const skipped = result.skipped ?? 0;
      if (created > 0) {
        toast.success(`Attendance marked for ${created} student${created > 1 ? 's' : ''}`);
      } else if (skipped > 0) {
        toast(`Attendance already marked for ${skipped} student${skipped > 1 ? 's' : ''} on this date — no new records created`, { icon: '⚠' });
      } else {
        toast.success('Attendance marked successfully');
      }
      navigate('/attendance');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to submit attendance');
    } finally {
      setSubmitting(false);
    }
  };

  const statusCounts = (status: AttendanceStatus) => records.filter((r) => r.status === status).length;

  const canProceedToStep2 = form.classId && form.subjectId && form.date;
  const canProceedToStep3 = records.length > 0;

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">Mark Attendance</h1>
        <div className="flex items-center gap-2">
          {[1, 2, 3].map((s) => (
            <span
              key={s}
              className={`flex items-center gap-1 text-sm font-medium px-3 py-1.5 rounded-full transition-colors ${
                step === s
                  ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300'
                  : step > s
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'
                  : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-current text-white flex items-center justify-center text-xs font-bold">
                {step > s ? <FaCheckCircle className="w-3 h-3" /> : s}
              </span>
              Step {s}
            </span>
          ))}
        </div>
      </div>

      {step === 1 && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Select Class & Subject</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Class *</label>
              <select
                className="input-field"
                value={form.classId}
                onChange={(e) => setForm((p) => ({ ...p, classId: e.target.value, streamId: '' }))}
              >
                <option value="">Select Class</option>
                {classes.map((c) => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Stream</label>
              <select
                className="input-field"
                value={form.streamId}
                onChange={(e) => setForm((p) => ({ ...p, streamId: e.target.value }))}
              >
                <option value="">All Streams</option>
                {streams.map((s) => (
                  <option key={s._id} value={s._id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Subject *</label>
              <select
                className="input-field"
                value={form.subjectId}
                onChange={(e) => setForm((p) => ({ ...p, subjectId: e.target.value }))}
              >
                <option value="">Select Subject</option>
                {subjects.map((s) => (
                  <option key={s._id} value={s._id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Date *</label>
              <input
                type="date"
                className="input-field"
                value={form.date}
                onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Academic Year</label>
              <select
                className="input-field"
                value={form.academicYearId}
                onChange={(e) => setForm((p) => ({ ...p, academicYearId: e.target.value, termId: '' }))}
              >
                <option value="">Select Academic Year</option>
                {academicYears.map((y) => (
                  <option key={y._id} value={y._id}>{y.name}{y.isCurrent ? ' (Current)' : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Term</label>
              <select
                className="input-field"
                value={form.termId}
                onChange={(e) => setForm((p) => ({ ...p, termId: e.target.value }))}
              >
                <option value="">Select Term</option>
                {filteredTerms.map((t) => (
                  <option key={t._id} value={t._id}>{t.name}{t.isCurrent ? ' (Current)' : ''}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end mt-6">
            <button
              className="btn-primary"
              disabled={!canProceedToStep2}
              onClick={() => {
                fetchStudents();
                setStep(2);
              }}
            >
              Next: Select Students
              <FaChevronRight className="w-4 h-4 ml-1" />
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="card">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Mark Attendance ({records.length} students)
            </h2>
            <div className="flex items-center gap-2">
              <button className="btn-secondary text-sm" onClick={() => markAll('present')}>
                <FaUserCheck className="w-4 h-4 mr-1" />
                Mark All Present
              </button>
              <button className="btn-secondary text-sm" onClick={() => markAll('absent')}>
                <FaUserTimes className="w-4 h-4 mr-1" />
                Mark All Absent
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary-600" />
            </div>
          ) : records.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <FaUsers className="w-12 h-12 mx-auto mb-2" />
              <p>No students found for the selected class</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">#</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Student Name</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Admission No</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {records.map((r, idx) => (
                    <tr key={r.studentId} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                      <td className="py-3 px-4 text-gray-500 dark:text-gray-400">{idx + 1}</td>
                      <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">{r.name}</td>
                      <td className="py-3 px-4 text-gray-700 dark:text-gray-300">{r.admissionNumber}</td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {statusOptions.map((opt) => (
                            <label
                              key={opt.value}
                              className={`cursor-pointer px-2 py-1 rounded-md border text-xs font-medium transition-colors ${
                                r.status === opt.value
                                  ? `${opt.color} bg-opacity-10`
                                  : 'text-gray-400 border-gray-200 dark:border-gray-600 hover:border-gray-400'
                              }`}
                            >
                              <input
                                type="radio"
                                name={`status-${r.studentId}`}
                                value={opt.value}
                                checked={r.status === opt.value}
                                onChange={() => updateRecord(r.studentId, 'status', opt.value)}
                                className="sr-only"
                              />
                              {opt.label}
                            </label>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="text"
                          className="input-field py-1 text-xs"
                          placeholder="Optional remark..."
                          value={r.remarks}
                          onChange={(e) => updateRecord(r.studentId, 'remarks', e.target.value)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button className="btn-secondary" onClick={() => setStep(1)}>
              <FaChevronLeft className="w-4 h-4 mr-1" />
              Back
            </button>
            <button
              className="btn-primary"
              disabled={!canProceedToStep3}
              onClick={() => setStep(3)}
            >
              Next: Review
              <FaChevronRight className="w-4 h-4 ml-1" />
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Review & Submit</h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-6">
            {statusOptions.map((opt) => {
              const count = getCountByStatus(opt.value);
              return (
                <div key={opt.value} className="stat-card text-center">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{count}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{opt.label}</p>
                </div>
              );
            })}
          </div>

          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 mb-6">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Details</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400">Date:</span>
                <span className="ml-1 text-gray-900 dark:text-white font-medium">{form.date}</span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Students:</span>
                <span className="ml-1 text-gray-900 dark:text-white font-medium">{records.length}</span>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto max-h-60 mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 px-3 font-medium text-gray-500 dark:text-gray-400">Name</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-500 dark:text-gray-400">Admission</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-500 dark:text-gray-400">Status</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-500 dark:text-gray-400">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {records.map((r) => (
                  <tr key={r.studentId}>
                    <td className="py-2 px-3 text-gray-900 dark:text-white">{r.name}</td>
                    <td className="py-2 px-3 text-gray-700 dark:text-gray-300">{r.admissionNumber}</td>
                    <td className="py-2 px-3">
                      <span className="badge text-xs">{r.status}</span>
                    </td>
                    <td className="py-2 px-3 text-gray-500 dark:text-gray-400">{r.remarks || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
            <button className="btn-secondary" onClick={() => setStep(2)}>
              <FaChevronLeft className="w-4 h-4 mr-1" />
              Back
            </button>
            <button className="btn-primary" disabled={submitting} onClick={handleSubmit}>
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-1" />
                  Submitting...
                </>
              ) : (
                <>
                  <FaSave className="w-4 h-4 mr-1" />
                  Submit Attendance
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );

  function getCountByStatus(status: AttendanceStatus): number {
    return records.filter((r) => r.status === status).length;
  }
}