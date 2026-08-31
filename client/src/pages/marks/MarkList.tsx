import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import StatsCard from '../../components/common/StatsCard';
import { useAuth } from '../../context/AuthContext';
import type { Mark, Assessment, Class, Subject, Stream, ApiResponse } from '../../types';
import {
  FaPlus, FaClipboardCheck, FaCheckCircle, FaTimesCircle, FaChartBar, FaEye, FaCheckDouble, FaTrophy, FaSortAmountDown, FaSortAmountUp,
} from 'react-icons/fa';

interface MarkStats {
  averageScore: number;
  passRate: number;
  highestScore: number;
  lowestScore: number;
  totalMarks: number;
}

type MarkStatus = 'pending' | 'approved' | '';

interface Filters {
  assessmentId: string;
  classId: string;
  subjectId: string;
  streamId: string;
  term: string;
  status: MarkStatus;
}

const initialFilters: Filters = {
  assessmentId: '',
  classId: '',
  subjectId: '',
  streamId: '',
  term: '',
  status: '',
};

export default function MarkList() {
  const navigate = useNavigate();
  const { isHeadteacher, isAcademicTeacher } = useAuth();
  const canApprove = isHeadteacher || isAcademicTeacher;
  const [marks, setMarks] = useState<Mark[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [streams, setStreams] = useState<Stream[]>([]);
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [stats, setStats] = useState<MarkStats>({ averageScore: 0, passRate: 0, highestScore: 0, lowestScore: 0, totalMarks: 0 });
  const [editMark, setEditMark] = useState<Mark | null>(null);
  const [editScore, setEditScore] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [viewMark, setViewMark] = useState<Mark | null>(null);
  const [showBulkApprove, setShowBulkApprove] = useState(false);
  const [selectedMarks, setSelectedMarks] = useState<Set<string>>(new Set());
  const [approving, setApproving] = useState(false);

  const fetchMeta = useCallback(async () => {
    try {
      const [assessmentsRes, classesRes, subjectsRes] = await Promise.all([
        api.get<ApiResponse<{ assessments: Assessment[] }>>('/assessments'),
        api.get<ApiResponse<Class[]>>('/classes'),
        api.get<ApiResponse<Subject[]>>('/subjects'),
      ]);
      setAssessments(assessmentsRes.data.data?.assessments || []);
      setClasses(classesRes.data.data || []);
      setSubjects(subjectsRes.data.data || []);
    } catch {
      // non-blocking
    }
  }, []);

  useEffect(() => { fetchMeta(); }, [fetchMeta]);

  useEffect(() => {
    if (filters.classId) {
      const cls = classes.find((c) => c._id === filters.classId);
      const strms = cls?.streams?.filter((s): s is Stream => typeof s === 'object') || [];
      setStreams(strms);
    } else {
      setStreams([]);
    }
  }, [filters.classId, classes]);

  const fetchMarks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (filters.assessmentId) params.assessment = filters.assessmentId;
      if (filters.classId) params.class = filters.classId;
      if (filters.subjectId) params.subject = filters.subjectId;
      if (filters.streamId) params.stream = filters.streamId;
      if (filters.term) params.term = filters.term;
      if (filters.status === 'approved') params.isApproved = 'true';
      else if (filters.status === 'pending') params.isApproved = 'false';

      const { data } = await api.get('/marks', { params });
      const list = (data.data || []) as Mark[];
      setMarks(list);

      if (list.length > 0) {
        const scores = list.map((m) => m.score);
        const total = list.length;
        const avg = scores.reduce((a, b) => a + b, 0) / total;
        const passing = list.filter((m) => {
          if (m.grade) return !['F', 'E', 'BE', 'Below Expectation'].includes(m.grade);
          return m.score >= (m.totalScore > 0 ? m.totalScore * 0.4 : 40);
        }).length;
        setStats({
          averageScore: Math.round(avg * 100) / 100,
          passRate: Math.round((passing / total) * 100),
          highestScore: Math.max(...scores),
          lowestScore: Math.min(...scores),
          totalMarks: total,
        });
      } else {
        setStats({ averageScore: 0, passRate: 0, highestScore: 0, lowestScore: 0, totalMarks: 0 });
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to load marks';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchMarks(); }, [fetchMarks]);

  const handleEdit = (mark: Mark) => {
    setEditMark(mark);
    setEditScore(String(mark.score));
  };

  const handleSaveEdit = async () => {
    if (!editMark) return;
    const score = parseFloat(editScore);
    if (isNaN(score) || score < 0) {
      toast.error('Please enter a valid score');
      return;
    }
    setSavingEdit(true);
    try {
      await api.put(`/marks/${editMark._id}`, { score });
      toast.success('Score updated');
      setEditMark(null);
      fetchMarks();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update score');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleApprove = async (mark: Mark) => {
    if (!canApprove) return;
    try {
      await api.put(`/marks/${mark._id}/approve`, { markIds: [mark._id] });
      toast.success(`Mark approved for ${getStudentName(mark)}`);
      fetchMarks();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to approve mark');
    }
  };

  const handleBulkApprove = async () => {
    if (selectedMarks.size === 0) return;
    setApproving(true);
    try {
      const markIds = Array.from(selectedMarks);
      await api.put(`/marks/${markIds[0]}/approve`, { markIds });
      toast.success(`${markIds.length} mark(s) approved`);
      setSelectedMarks(new Set());
      setShowBulkApprove(false);
      fetchMarks();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to approve marks');
    } finally {
      setApproving(false);
    }
  };

  const toggleMarkSelection = (markId: string) => {
    setSelectedMarks((prev) => {
      const next = new Set(prev);
      if (next.has(markId)) next.delete(markId);
      else next.add(markId);
      return next;
    });
  };

  const toggleAllPending = () => {
    const pendingIds = marks.filter((m) => !m.isApproved).map((m) => m._id);
    if (selectedMarks.size === pendingIds.length) {
      setSelectedMarks(new Set());
    } else {
      setSelectedMarks(new Set(pendingIds));
    }
  };

  const getStudentName = (mark: Mark): string => {
    if (typeof mark.student === 'object' && mark.student) return (mark.student as any).fullName || (mark.student as any).firstName + ' ' + (mark.student as any).lastName;
    return typeof mark.student === 'string' ? mark.student : '-';
  };

  const getAdmissionNo = (mark: Mark): string => {
    if (typeof mark.student === 'object' && mark.student) return (mark.student as any).admissionNumber || '';
    return '';
  };

  const getAssessmentName = (mark: Mark): string => {
    if (typeof mark.assessment === 'object' && mark.assessment) return (mark.assessment as any).name || '';
    return typeof mark.assessment === 'string' ? mark.assessment : '-';
  };

  const handleViewDetail = (mark: Mark) => setViewMark(mark);

  const pendingMarks = marks.filter((m) => !m.isApproved);
  const allPendingSelected = pendingMarks.length > 0 && selectedMarks.size === pendingMarks.length;

  const columns = [
    ...(canApprove ? [{
      key: 'select',
      label: '',
      render: (m: Mark) => (
        <input
          type="checkbox"
          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          checked={selectedMarks.has(m._id)}
          onChange={() => toggleMarkSelection(m._id)}
          disabled={m.isApproved}
        />
      ),
    }] : []),
    {
      key: 'studentName',
      label: 'Student Name',
      render: (m: Mark) => (
        <span className="font-medium text-gray-900 dark:text-white">{getStudentName(m)}</span>
      ),
      sortable: true,
    },
    {
      key: 'admissionNumber',
      label: 'Admission No',
      render: (m: Mark) => (
        <span className="text-gray-600 dark:text-gray-400">{getAdmissionNo(m)}</span>
      ),
    },
    {
      key: 'assessment',
      label: 'Assessment',
      render: (m: Mark) => <span>{getAssessmentName(m)}</span>,
      sortable: true,
    },
    {
      key: 'subject',
      label: 'Subject',
      render: (m: Mark) => {
        const name = typeof m.subject === 'object' ? (m.subject as any).name || m.subject : m.subject;
        return <span>{name}</span>;
      },
      sortable: true,
    },
    {
      key: 'score',
      label: 'Score',
      render: (m: Mark) => (
        <span className="font-semibold">{m.score}/{m.totalScore}</span>
      ),
      sortable: true,
    },
    {
      key: 'grade',
      label: 'Grade',
      render: (m: Mark) => m.grade ? (
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-sm font-bold">
          {m.grade}
        </span>
      ) : <span className="text-gray-400">-</span>,
      sortable: true,
    },
    {
      key: 'isApproved',
      label: 'Status',
      render: (m: Mark) => m.isApproved ? (
        <span className="badge badge-success">
          <FaCheckCircle className="w-3 h-3 mr-1" />
          Approved
        </span>
      ) : (
        <span className="badge badge-warning">
          <FaTimesCircle className="w-3 h-3 mr-1" />
          Pending
        </span>
      ),
      sortable: true,
    },
    ...(canApprove ? [{
      key: 'actions',
      label: 'Action',
      render: (m: Mark) => !m.isApproved ? (
        <button
          className="text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 text-sm font-medium"
          onClick={(e) => { e.stopPropagation(); handleApprove(m); }}
        >
          <FaCheckDouble className="w-3.5 h-3.5 mr-1 inline" />
          Approve
        </button>
      ) : null,
    }] : []),
  ];

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">Marks Records</h1>
        <div className="flex items-center gap-2">
          {canApprove && (
            <button
              className="btn-secondary"
              onClick={() => {
                setSelectedMarks(new Set(pendingMarks.map((m) => m._id)));
                setShowBulkApprove(true);
              }}
              disabled={pendingMarks.length === 0}
            >
              <FaCheckDouble className="w-4 h-4 mr-1" />
              Approve Marks ({pendingMarks.length})
            </button>
          )}
          <button className="btn-primary" onClick={() => navigate('/marks/enter')}>
            <FaPlus className="w-4 h-4 mr-1" />
            Enter Marks
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatsCard title="Total Marks" value={stats.totalMarks} icon={<FaClipboardCheck className="w-5 h-5" />} color="blue" />
        <StatsCard title="Average Score" value={stats.averageScore} icon={<FaChartBar className="w-5 h-5" />} color="green" />
        <StatsCard title="Pass Rate" value={`${stats.passRate}%`} icon={<FaTrophy className="w-5 h-5" />} color="yellow" />
        <StatsCard title="Highest Score" value={stats.highestScore} icon={<FaSortAmountUp className="w-5 h-5" />} color="purple" />
        <StatsCard title="Lowest Score" value={stats.lowestScore} icon={<FaSortAmountDown className="w-5 h-5" />} color="red" />
      </div>

      <div className="card">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
          <div>
            <label className="label">Assessment</label>
            <select className="input-field" value={filters.assessmentId} onChange={(e) => setFilters((p) => ({ ...p, assessmentId: e.target.value }))}>
              <option value="">All Assessments</option>
              {assessments.map((a) => (
                <option key={a._id} value={a._id}>{a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Class</label>
            <select className="input-field" value={filters.classId} onChange={(e) => setFilters((p) => ({ ...p, classId: e.target.value, streamId: '' }))}>
              <option value="">All Classes</option>
              {classes.map((c) => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Subject</label>
            <select className="input-field" value={filters.subjectId} onChange={(e) => setFilters((p) => ({ ...p, subjectId: e.target.value }))}>
              <option value="">All Subjects</option>
              {subjects.map((s) => (
                <option key={s._id} value={s._id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Stream</label>
            <select className="input-field" value={filters.streamId} onChange={(e) => setFilters((p) => ({ ...p, streamId: e.target.value }))}>
              <option value="">All Streams</option>
              {streams.map((s) => (
                <option key={s._id} value={s._id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Term</label>
            <input type="text" className="input-field" placeholder="e.g. Term 1" value={filters.term} onChange={(e) => setFilters((p) => ({ ...p, term: e.target.value }))} />
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input-field" value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value as MarkStatus }))}>
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
            </select>
          </div>
        </div>

        {error && !loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FaTimesCircle className="w-12 h-12 text-red-500 dark:text-red-400 mx-auto mb-2" />
            <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
            <button onClick={fetchMarks} className="btn-primary">Retry</button>
          </div>
        ) : (
          <DataTable
            columns={columns as any}
            data={marks}
            loading={loading}
            onView={handleViewDetail}
            onEdit={handleEdit}
          />
        )}
      </div>

      <Modal isOpen={!!editMark} onClose={() => setEditMark(null)} title="Edit Score" size="sm">
        {editMark && (
          <div className="space-y-4">
            <div>
              <label className="label">Student</label>
              <p className="text-gray-900 dark:text-white font-medium">{getStudentName(editMark)}</p>
            </div>
            <div>
              <label className="label">Assessment</label>
              <p className="text-gray-700 dark:text-gray-300">{getAssessmentName(editMark)}</p>
            </div>
            <div>
              <label className="label">Score (max {editMark.totalScore})</label>
              <input
                type="number"
                className="input-field"
                min={0}
                max={editMark.totalScore}
                step={0.5}
                value={editScore}
                onChange={(e) => setEditScore(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn-secondary" onClick={() => setEditMark(null)}>Cancel</button>
              <button className="btn-primary" disabled={savingEdit} onClick={handleSaveEdit}>
                {savingEdit ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={!!viewMark} onClose={() => setViewMark(null)} title="Mark Details" size="lg">
        {viewMark && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Student</label>
                <p className="text-gray-900 dark:text-white font-medium">{getStudentName(viewMark)}</p>
              </div>
              <div>
                <label className="label">Admission No</label>
                <p className="text-gray-700 dark:text-gray-300">{getAdmissionNo(viewMark)}</p>
              </div>
              <div>
                <label className="label">Assessment</label>
                <p className="text-gray-700 dark:text-gray-300">{getAssessmentName(viewMark)}</p>
              </div>
              <div>
                <label className="label">Subject</label>
                <p className="text-gray-700 dark:text-gray-300">
                  {typeof viewMark.subject === 'object' ? (viewMark.subject as any).name || viewMark.subject : viewMark.subject}
                </p>
              </div>
              <div>
                <label className="label">Score</label>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {viewMark.score} <span className="text-base text-gray-500 dark:text-gray-400">/ {viewMark.totalScore}</span>
                </p>
              </div>
              <div>
                <label className="label">Grade</label>
                {viewMark.grade ? (
                  <span className="badge badge-success text-base px-3 py-1">{viewMark.grade}</span>
                ) : (
                  <span className="text-gray-400">Not calculated</span>
                )}
              </div>
              {viewMark.gradePoint !== undefined && (
                <div>
                  <label className="label">Grade Point</label>
                  <p className="text-gray-900 dark:text-white font-medium">{viewMark.gradePoint}</p>
                </div>
              )}
              <div>
                <label className="label">Status</label>
                {viewMark.isApproved ? (
                  <span className="badge badge-success">Approved</span>
                ) : (
                  <span className="badge badge-warning">Pending</span>
                )}
              </div>
              {viewMark.remarks && (
                <div className="col-span-2">
                  <label className="label">Remarks</label>
                  <p className="text-gray-700 dark:text-gray-300">{viewMark.remarks}</p>
                </div>
              )}
              <div>
                <label className="label">Submitted At</label>
                <p className="text-gray-700 dark:text-gray-300">{new Date(viewMark.submittedAt).toLocaleString()}</p>
              </div>
              {viewMark.approvedBy && (
                <div>
                  <label className="label">Approved By</label>
                  <p className="text-gray-700 dark:text-gray-300">{typeof viewMark.approvedBy === 'object' ? (viewMark.approvedBy as any).fullName || viewMark.approvedBy : viewMark.approvedBy}</p>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
              {!viewMark.isApproved && canApprove && (
                <button className="btn-primary" onClick={() => { setViewMark(null); handleApprove(viewMark); }}>
                  <FaCheckDouble className="w-4 h-4 mr-1" />
                  Approve
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={showBulkApprove} onClose={() => setShowBulkApprove(false)} title="Approve Marks" size="lg">
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Select the marks you want to approve. {selectedMarks.size} of {pendingMarks.length} pending marks selected.
          </p>

          <div className="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-700">
            <input
              type="checkbox"
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              checked={allPendingSelected}
              onChange={toggleAllPending}
            />
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {allPendingSelected ? 'Deselect All' : 'Select All Pending'}
            </label>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {pendingMarks.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <FaCheckCircle className="w-10 h-10 mx-auto mb-2 text-green-500" />
                <p>All marks are already approved</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 px-3 font-medium text-gray-500 dark:text-gray-400 w-8"></th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500 dark:text-gray-400">Student</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500 dark:text-gray-400">Assessment</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500 dark:text-gray-400">Subject</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500 dark:text-gray-400">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                  {pendingMarks.map((m) => (
                    <tr
                      key={m._id}
                      className={`cursor-pointer transition-colors ${
                        selectedMarks.has(m._id) ? 'bg-primary-50 dark:bg-primary-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'
                      }`}
                      onClick={() => toggleMarkSelection(m._id)}
                    >
                      <td className="py-2 px-3">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                          checked={selectedMarks.has(m._id)}
                          onChange={() => toggleMarkSelection(m._id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td className="py-2 px-3 font-medium text-gray-900 dark:text-white">{getStudentName(m)}</td>
                      <td className="py-2 px-3 text-gray-700 dark:text-gray-300">{getAssessmentName(m)}</td>
                      <td className="py-2 px-3 text-gray-700 dark:text-gray-300">
                        {typeof m.subject === 'object' ? (m.subject as any).name || '-' : m.subject || '-'}
                      </td>
                      <td className="py-2 px-3 font-semibold text-gray-900 dark:text-white">{m.score}/{m.totalScore}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
            <button className="btn-secondary" onClick={() => setShowBulkApprove(false)}>Cancel</button>
            <button
              className="btn-primary"
              disabled={selectedMarks.size === 0 || approving}
              onClick={handleBulkApprove}
            >
              {approving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-1" />
                  Approving...
                </>
              ) : (
                <>
                  <FaCheckDouble className="w-4 h-4 mr-1" />
                  Approve {selectedMarks.size} Mark(s)
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
