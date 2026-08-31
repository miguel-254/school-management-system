import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import type { Assessment, Class, Subject, Stream, GradeScale, Student, ApiResponse } from '../../types';
import {
  FaChevronLeft, FaChevronRight, FaSave, FaUserGraduate, FaClipboardCheck, FaExclamationTriangle, FaCheckCircle, FaTimesCircle, FaArrowRight, FaPercentage,
} from 'react-icons/fa';

interface StudentRecord {
  studentId: string;
  name: string;
  admissionNumber: string;
  score: string;
  remarks: string;
  gradePreview?: string;
}

interface FormData {
  assessmentId: string;
  classId: string;
  subjectId: string;
  streamId: string;
  term: string;
}

export default function EnterMarks() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [streams, setStreams] = useState<Stream[]>([]);
  const [gradeScales, setGradeScales] = useState<GradeScale[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [records, setRecords] = useState<StudentRecord[]>([]);
  const [selectedAssessment, setSelectedAssessment] = useState<Assessment | null>(null);
  const [quickFillValue, setQuickFillValue] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState<FormData>({
    assessmentId: '',
    classId: '',
    subjectId: '',
    streamId: '',
    term: '',
  });

  const fetchMeta = useCallback(async () => {
    try {
      const [assessmentsRes, classesRes, subjectsRes, gradesRes] = await Promise.all([
        api.get<ApiResponse<{ assessments: Assessment[] }>>('/assessments'),
        api.get<ApiResponse<Class[]>>('/classes'),
        api.get<ApiResponse<Subject[]>>('/subjects'),
        api.get<ApiResponse<GradeScale[]>>('/grade-scales'),
      ]);
      setAssessments(assessmentsRes.data.data?.assessments || []);
      setClasses(classesRes.data.data || []);
      setSubjects(subjectsRes.data.data || []);
      setGradeScales(gradesRes.data.data || []);
    } catch {
      // non-blocking
    }
  }, []);

  useEffect(() => { fetchMeta(); }, [fetchMeta]);

  useEffect(() => {
    if (form.classId) {
      const cls = classes.find((c) => c._id === form.classId);
      const strms = cls?.streams?.filter((s): s is Stream => typeof s === 'object') || [];
      setStreams(strms);
    } else {
      setStreams([]);
    }
  }, [form.classId, classes]);

  useEffect(() => {
    if (form.assessmentId) {
      const ass = assessments.find((a) => a._id === form.assessmentId) || null;
      setSelectedAssessment(ass);
      if (ass) {
        setForm((p) => ({
          ...p,
          classId: p.classId || ass.class,
          subjectId: p.subjectId || ass.subject,
          streamId: p.streamId || ass.stream || '',
          term: p.term || (typeof ass.term === 'string' ? ass.term : ''),
        }));
      }
    } else {
      setSelectedAssessment(null);
    }
  }, [form.assessmentId, assessments]);

  const getGradePreview = (score: number): string | undefined => {
    const sorted = [...gradeScales].sort((a, b) => b.minScore - a.minScore);
    const match = sorted.find((g) => score >= g.minScore && score <= g.maxScore);
    return match?.name;
  };

  const fetchStudents = async () => {
    const missing: string[] = [];
    if (!form.assessmentId) missing.push('Assessment');
    if (!form.classId) missing.push('Class');
    if (!form.subjectId) missing.push('Subject');
    if (missing.length > 0) {
      toast.error(`Please select: ${missing.join(', ')}`);
      return;
    }

    setLoading(true);
    try {
      const params: Record<string, string> = {
        class: form.classId,
        subject: form.subjectId,
        assessment: form.assessmentId,
      };
      if (form.streamId) params.stream = form.streamId;

      const { data } = await api.get('/marks/students-for-entry', { params });
      const studentList = (data.data || []) as (Student & { existingMark?: { score: number; remarks: string; _id: string } })[];
      setStudents(studentList);
      setRecords(
        studentList.map((s) => ({
          studentId: s._id,
          name: s.fullName,
          admissionNumber: s.admissionNumber,
          score: s.existingMark?.score !== undefined ? String(s.existingMark.score) : '',
          remarks: s.existingMark?.remarks || '',
          gradePreview: s.existingMark?.score !== undefined ? getGradePreview(s.existingMark.score) : undefined,
        }))
      );
      setErrors({});

      if (studentList.length === 0) {
        toast.error('No students found for selection criteria');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  const updateRecord = (studentId: string, field: 'score' | 'remarks', value: string) => {
    setRecords((prev) =>
      prev.map((r) => {
        if (r.studentId !== studentId) return r;
        const updated = { ...r, [field]: value };
        if (field === 'score') {
          const parsed = parseFloat(value);
          updated.gradePreview = !isNaN(parsed) ? getGradePreview(parsed) : undefined;
        }
        return updated;
      })
    );
    setErrors((prev) => {
      const next = { ...prev };
      delete next[studentId];
      return next;
    });
  };

  const quickFillAll = () => {
    const val = parseFloat(quickFillValue);
    if (isNaN(val) || val < 0) {
      toast.error('Enter a valid score for quick fill');
      return;
    }
    if (selectedAssessment && val > selectedAssessment.maxScore) {
      toast.error(`Score cannot exceed ${selectedAssessment.maxScore}`);
      return;
    }
    setRecords((prev) =>
      prev.map((r) => ({
        ...r,
        score: quickFillValue,
        gradePreview: getGradePreview(val),
      }))
    );
  };

  const validateScores = (): boolean => {
    const newErrors: Record<string, string> = {};
    const maxScore = selectedAssessment?.maxScore || 100;
    let hasMissing = false;

    records.forEach((r) => {
      if (!r.score.trim()) {
        newErrors[r.studentId] = 'Score is required';
        hasMissing = true;
      } else {
        const val = parseFloat(r.score);
        if (isNaN(val)) {
          newErrors[r.studentId] = 'Must be a number';
        } else if (val < 0) {
          newErrors[r.studentId] = 'Cannot be negative';
        } else if (val > maxScore) {
          newErrors[r.studentId] = `Max is ${maxScore}`;
        }
      }
    });

    setErrors(newErrors);
    if (hasMissing) {
      toast.error(`Missing scores for ${records.filter((r) => !r.score.trim()).length} student(s)`);
    }
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateScores()) return;

    if (records.length === 0) {
      toast.error('No records to submit');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/marks/bulk-enter', {
        assessment: form.assessmentId,
        class: form.classId,
        subject: form.subjectId,
        marks: records.map((r) => ({
          student: r.studentId,
          score: parseFloat(r.score),
          remarks: r.remarks || undefined,
        })),
      });
      toast.success('Marks submitted successfully');
      navigate('/marks');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to submit marks');
    } finally {
      setSubmitting(false);
    }
  };

  const missingCount = records.filter((r) => !r.score.trim()).length;
  const canProceedToStep2 = form.assessmentId && form.classId && form.subjectId;
  const canProceedToStep3 = records.length > 0 && missingCount === 0;

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">Enter Marks</h1>
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
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Select Assessment & Class</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Assessment *</label>
              <select
                className="input-field"
                value={form.assessmentId}
                onChange={(e) => setForm((p) => ({ ...p, assessmentId: e.target.value }))}
              >
                <option value="">Select Assessment</option>
                {assessments.map((a) => (
                  <option key={a._id} value={a._id}>{a.name} ({a.maxScore} pts)</option>
                ))}
              </select>
            </div>
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
              <label className="label">Term</label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. Term 1"
                value={form.term}
                onChange={(e) => setForm((p) => ({ ...p, term: e.target.value }))}
              />
            </div>
          </div>

          {selectedAssessment && (
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                <strong>{selectedAssessment.name}</strong> — Max Score: <strong>{selectedAssessment.maxScore}</strong>, Weight: <strong>{selectedAssessment.weight}%</strong>
                {selectedAssessment.type && <> ({selectedAssessment.type})</>}
              </p>
            </div>
          )}

          <div className="flex justify-end mt-6">
            <button className="btn-primary" disabled={!canProceedToStep2} onClick={() => { fetchStudents(); setStep(2); }}>
              Next: Enter Marks
              <FaChevronRight className="w-4 h-4 ml-1" />
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="card">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Student Marks ({records.length} students)
              </h2>
              {selectedAssessment && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Max score: {selectedAssessment.maxScore} | {missingCount > 0 && (
                    <span className="text-amber-600 dark:text-amber-400 font-medium">{missingCount} missing</span>
                  )}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  className="input-field w-20 py-1 text-sm"
                  placeholder="Score"
                  min={0}
                  max={selectedAssessment?.maxScore || 100}
                  value={quickFillValue}
                  onChange={(e) => setQuickFillValue(e.target.value)}
                />
                <button className="btn-secondary text-sm" onClick={quickFillAll}>
                  <FaPercentage className="w-3 h-3 mr-1" />
                  Set All
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary-600" />
            </div>
          ) : records.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <FaUserGraduate className="w-12 h-12 mx-auto mb-2" />
              <p>No students found for the selected criteria</p>
              <button className="btn-secondary mt-3" onClick={() => setStep(1)}>Go Back</button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">#</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Student Name</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Admission No</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">
                      Score <span className="text-gray-400">(max {selectedAssessment?.maxScore || 100})</span>
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Grade Preview</th>
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
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            className={`input-field py-1 w-24 text-sm ${errors[r.studentId] ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                            min={0}
                            max={selectedAssessment?.maxScore || 100}
                            step={0.5}
                            placeholder="Score"
                            value={r.score}
                            onChange={(e) => updateRecord(r.studentId, 'score', e.target.value)}
                          />
                          {errors[r.studentId] && (
                            <FaExclamationTriangle className="w-4 h-4 text-red-500 shrink-0" title={errors[r.studentId]} />
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {r.gradePreview ? (
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-sm font-bold">
                            {r.gradePreview}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
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

          {Object.keys(errors).length > 0 && (
            <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <p className="text-sm text-amber-700 dark:text-amber-300 flex items-center gap-1">
                <FaExclamationTriangle className="w-4 h-4" />
                {Object.keys(errors).length} error(s) found. Please fix before proceeding.
              </p>
            </div>
          )}

          <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button className="btn-secondary" onClick={() => setStep(1)}>
              <FaChevronLeft className="w-4 h-4 mr-1" />
              Back
            </button>
            <button className="btn-primary" disabled={!canProceedToStep3 || loading} onClick={() => {
              if (validateScores()) setStep(3);
            }}>
              Next: Review
              <FaChevronRight className="w-4 h-4 ml-1" />
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Review & Submit</h2>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="stat-card text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{records.length}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Total Students</p>
            </div>
            <div className="stat-card text-center">
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {records.filter((r) => r.score.trim()).length}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Scored</p>
            </div>
            <div className="stat-card text-center">
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{missingCount}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Missing</p>
            </div>
            <div className="stat-card text-center">
              <p className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                {selectedAssessment?.maxScore || '-'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Max Score</p>
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 mb-6">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Selection Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400">Assessment:</span>
                <span className="ml-1 text-gray-900 dark:text-white font-medium">{selectedAssessment?.name || form.assessmentId}</span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Class:</span>
                <span className="ml-1 text-gray-900 dark:text-white font-medium">{classes.find((c) => c._id === form.classId)?.name || form.classId}</span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Subject:</span>
                <span className="ml-1 text-gray-900 dark:text-white font-medium">{subjects.find((s) => s._id === form.subjectId)?.name || form.subjectId}</span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Students:</span>
                <span className="ml-1 text-gray-900 dark:text-white font-medium">{records.length}</span>
              </div>
            </div>
          </div>

          {missingCount > 0 && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg mb-4">
              <p className="text-sm text-red-700 dark:text-red-300 flex items-center gap-1">
                <FaExclamationTriangle className="w-4 h-4 shrink-0" />
                Warning: {missingCount} student(s) have missing scores. They will not be included in submission.
              </p>
            </div>
          )}

          <div className="overflow-x-auto max-h-60 mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 px-3 font-medium text-gray-500 dark:text-gray-400">Name</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-500 dark:text-gray-400">Admission</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-500 dark:text-gray-400">Score</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-500 dark:text-gray-400">Grade</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-500 dark:text-gray-400">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {records.map((r) => (
                  <tr key={r.studentId} className={!r.score.trim() ? 'bg-red-50 dark:bg-red-900/10' : ''}>
                    <td className="py-2 px-3 text-gray-900 dark:text-white">{r.name}</td>
                    <td className="py-2 px-3 text-gray-700 dark:text-gray-300">{r.admissionNumber}</td>
                    <td className="py-2 px-3">
                      {r.score.trim() ? (
                        <span className="font-semibold">{r.score}</span>
                      ) : (
                        <span className="text-red-500 italic">Missing</span>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      {r.gradePreview ? (
                        <span className="badge badge-info">{r.gradePreview}</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
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
            <button className="btn-primary" disabled={submitting || records.every((r) => !r.score.trim())} onClick={handleSubmit}>
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-1" />
                  Submitting...
                </>
              ) : (
                <>
                  <FaSave className="w-4 h-4 mr-1" />
                  Submit Marks
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}