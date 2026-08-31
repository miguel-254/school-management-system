import { useState, useEffect, useCallback } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import {
  FaPlus, FaLayerGroup, FaShareAlt, FaPrint, FaFileExcel, FaTrash, FaEye,
  FaCheckCircle, FaClock, FaExclamationTriangle, FaRedo, FaSearch,
  FaSpinner, FaUserGraduate, FaSchool,
} from 'react-icons/fa';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import StatsCard from '../../components/common/StatsCard';
import ReportCardPreview from './ReportCardPreview';
import type { ReportCard, Class, Stream, Term, AcademicYear, ApiResponse } from '../../types';

interface FiltersState {
  classId: string;
  streamId: string;
  termId: string;
  academicYearId: string;
  status: '' | 'draft' | 'published';
}

interface StudentsResponse {
  _id: string;
  fullName: string;
  admissionNumber: string;
  class: { _id: string; name: string };
  stream?: { _id: string; name: string };
}

export default function ReportCardList() {
  const [reportCards, setReportCards] = useState<ReportCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [classes, setClasses] = useState<Class[]>([]);
  const [streams, setStreams] = useState<Stream[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [stats, setStats] = useState({ total: 0, published: 0, pending: 0 });
  const [selectedCard, setSelectedCard] = useState<ReportCard | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const [filters, setFilters] = useState<FiltersState>({
    classId: '', streamId: '', termId: '', academicYearId: '', status: '',
  });

  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkForm, setBulkForm] = useState({ classId: '', termId: '', academicYearId: '' });
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);

  const [showSingleModal, setShowSingleModal] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [students, setStudents] = useState<StudentsResponse[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [singleForm, setSingleForm] = useState({ studentId: '', termId: '', academicYearId: '' });
  const [singleGenerating, setSingleGenerating] = useState(false);

  const fetchMeta = useCallback(async () => {
    try {
      const [classesRes, yearsRes, termsRes] = await Promise.all([
        api.get<ApiResponse<Class[]>>('/classes'),
        api.get<ApiResponse<AcademicYear[]>>('/academic-years'),
        api.get<ApiResponse<Term[]>>('/terms'),
      ]);
      setClasses(classesRes.data.data || []);
      setAcademicYears(yearsRes.data.data || []);
      setTerms(termsRes.data.data || []);
    } catch {
      // non-blocking
    }
  }, []);

  useEffect(() => {
    fetchMeta();
  }, [fetchMeta]);

  const fetchReportCards = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (filters.classId) params.class = filters.classId;
      if (filters.streamId) params.stream = filters.streamId;
      if (filters.termId) params.term = filters.termId;
      if (filters.academicYearId) params.academicYear = filters.academicYearId;
      if (filters.status) params.status = filters.status;

      const { data } = await api.get('/report-cards', { params });
      const list = (data.data?.reportCards || []) as ReportCard[];
      setReportCards(list);

      const total = list.length;
      const published = list.filter((r) => r.isPublished).length;
      setStats({ total, published, pending: total - published });
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to load report cards';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchReportCards();
  }, [fetchReportCards]);

  const fetchStreams = useCallback(async (classId: string) => {
    if (!classId) { setStreams([]); return; }
    try {
      const { data } = await api.get<ApiResponse<Stream[]>>(`/classes/${classId}/streams`);
      setStreams(data.data || []);
    } catch {
      setStreams([]);
    }
  }, []);

  useEffect(() => {
    fetchStreams(filters.classId);
  }, [filters.classId, fetchStreams]);

  const fetchStudents = useCallback(async (search: string) => {
    if (!search.trim()) { setStudents([]); return; }
    setStudentsLoading(true);
    try {
      const { data } = await api.get('/students', { params: { search, limit: '20' } });
      setStudents(data.data?.students || data.data || []);
    } catch {
      setStudents([]);
    } finally {
      setStudentsLoading(false);
    }
  }, []);

  const handlePublishAll = async () => {
    const confirmed = confirm('Publish all draft report cards? This action cannot be undone.');
    if (!confirmed) return;
    try {
      await api.put('/report-cards/publish-all');
      toast.success('All report cards published');
      fetchReportCards();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to publish all');
    }
  };

  const handleTogglePublish = async (card: ReportCard) => {
    try {
      await api.put(`/report-cards/${card._id}`, { isPublished: !card.isPublished });
      toast.success(card.isPublished ? 'Report card unpublished' : 'Report card published');
      fetchReportCards();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update status');
    }
  };

  const handleDelete = async (card: ReportCard) => {
    if (!confirm(`Delete report card for ${getStudentName(card)}? This cannot be undone.`)) return;
    try {
      await api.delete(`/report-cards/${card._id}`);
      toast.success('Report card deleted');
      fetchReportCards();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete');
    }
  };

  const handlePrint = (card: ReportCard) => {
    setSelectedCard(card);
    setShowPreview(true);
    setTimeout(() => window.print(), 500);
  };

  const handleExport = async (card: ReportCard) => {
    try {
      const res = await api.get(`/report-cards/${card._id}/export`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `report-card-${card._id}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Report card exported');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to export');
    }
  };

  const handleBulkGenerate = async () => {
    if (!bulkForm.classId || !bulkForm.termId || !bulkForm.academicYearId) {
      toast.error('Please select class, term, and academic year');
      return;
    }
    setBulkGenerating(true);
    setBulkProgress(0);
    try {
      await api.post('/report-cards/bulk-generate', bulkForm);
      toast.success('Report cards generated successfully');
      setShowBulkModal(false);
      setBulkForm({ classId: '', termId: '', academicYearId: '' });
      fetchReportCards();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to generate report cards');
    } finally {
      setBulkGenerating(false);
      setBulkProgress(0);
    }
  };

  const handleSingleGenerate = async () => {
    if (!singleForm.studentId || !singleForm.termId || !singleForm.academicYearId) {
      toast.error('Please select student, term, and academic year');
      return;
    }
    setSingleGenerating(true);
    try {
      await api.post('/report-cards/generate', singleForm);
      toast.success('Report card generated successfully');
      setShowSingleModal(false);
      setSingleForm({ studentId: '', termId: '', academicYearId: '' });
      setStudentSearch('');
      setStudents([]);
      fetchReportCards();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to generate report card');
    } finally {
      setSingleGenerating(false);
    }
  };

  const getStudentName = (card: ReportCard): string => {
    if (typeof card.student === 'object' && card.student) {
      return (card.student as any).fullName || (card.student as any).firstName + ' ' + (card.student as any).lastName || 'Unknown';
    }
    return 'Unknown';
  };

  const getAdmissionNo = (card: ReportCard): string => {
    if (typeof card.student === 'object' && card.student) {
      return (card.student as any).admissionNumber || '-';
    }
    return '-';
  };

  const getClassName = (card: ReportCard): string => {
    if (typeof card.class === 'object' && card.class) {
      return (card.class as any).name || '';
    }
    return card.class || '-';
  };

  const columns = [
    {
      key: 'student',
      label: 'Student Name',
      render: (card: ReportCard) => (
        <span className="font-medium text-gray-900 dark:text-white">{getStudentName(card)}</span>
      ),
      sortable: true,
    },
    {
      key: 'admission',
      label: 'Admission No',
      render: (card: ReportCard) => <span>{getAdmissionNo(card)}</span>,
    },
    {
      key: 'class',
      label: 'Class',
      render: (card: ReportCard) => <span>{getClassName(card)}</span>,
      sortable: true,
    },
    {
      key: 'term',
      label: 'Term',
      render: (card: ReportCard) => {
        if (typeof card.term === 'object' && card.term) return <span>{(card.term as any).name || ''}</span>;
        return <span>{card.term || '-'}</span>;
      },
      sortable: true,
    },
    {
      key: 'averageScore',
      label: 'Average Score',
      render: (card: ReportCard) => (
        <span className="font-semibold">{card.averageScore?.toFixed(1)}</span>
      ),
      sortable: true,
    },
    {
      key: 'grade',
      label: 'Grade',
      render: (card: ReportCard) => (
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-bold">
          {card.grade || '-'}
        </span>
      ),
      sortable: true,
    },
    {
      key: 'position',
      label: 'Position',
      render: (card: ReportCard) => (
        <span>{card.position}/{card.classSize}</span>
      ),
      sortable: true,
    },
    {
      key: 'isPublished',
      label: 'Status',
      render: (card: ReportCard) => (
        <span className={`badge ${card.isPublished ? 'badge-success' : 'badge-warning'}`}>
          {card.isPublished ? 'Published' : 'Draft'}
        </span>
      ),
      sortable: true,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">Report Cards</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <button className="btn-primary" onClick={() => setShowSingleModal(true)}>
            <FaPlus className="w-4 h-4 mr-1" />
            Generate Report Card
          </button>
          <button className="btn-secondary" onClick={() => setShowBulkModal(true)}>
            <FaLayerGroup className="w-4 h-4 mr-1" />
            Bulk Generate
          </button>
          <button className="btn-danger" onClick={handlePublishAll}>
            <FaShareAlt className="w-4 h-4 mr-1" />
            Publish All
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatsCard title="Total Generated" value={stats.total} icon={<FaSchool className="w-5 h-5" />} color="blue" />
        <StatsCard title="Published" value={stats.published} icon={<FaCheckCircle className="w-5 h-5" />} color="green" />
        <StatsCard title="Pending" value={stats.pending} icon={<FaClock className="w-5 h-5" />} color="yellow" />
      </div>

      <div className="card">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
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
            <select className="input-field" value={filters.termId} onChange={(e) => setFilters((p) => ({ ...p, termId: e.target.value }))}>
              <option value="">All Terms</option>
              {terms.map((t) => (
                <option key={t._id} value={t._id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Academic Year</label>
            <select className="input-field" value={filters.academicYearId} onChange={(e) => setFilters((p) => ({ ...p, academicYearId: e.target.value }))}>
              <option value="">All Years</option>
              {academicYears.map((y) => (
                <option key={y._id} value={y._id}>{y.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input-field" value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value as FiltersState['status'] }))}>
              <option value="">All Status</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </div>
        </div>

        {error && !loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FaExclamationTriangle className="w-12 h-12 text-red-500 dark:text-red-400 mb-3" />
            <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
            <button onClick={fetchReportCards} className="btn-primary inline-flex items-center gap-2">
              <FaRedo className="w-4 h-4" />
              Retry
            </button>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={reportCards}
            loading={loading}
            onView={(card) => { setSelectedCard(card); setShowPreview(true); }}
            onDelete={handleDelete}
          />
        )}
      </div>

      {selectedCard && (
        <div className="hidden print:block">
          <ReportCardPreview reportCard={selectedCard} onClose={() => {}} />
        </div>
      )}

      <Modal isOpen={showPreview && !window.matchMedia('print').matches} onClose={() => { setShowPreview(false); setSelectedCard(null); }} title="Report Card Preview" size="xl">
        {selectedCard && (
          <div className="space-y-4">
            <ReportCardPreview reportCard={selectedCard} onClose={() => setShowPreview(false)} />
            <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => { window.print(); }}
                className="btn-primary inline-flex items-center gap-2"
              >
                <FaPrint className="w-4 h-4" />
                Print
              </button>
              <button
                onClick={() => handleExport(selectedCard)}
                className="btn-secondary inline-flex items-center gap-2"
              >
                <FaFileExcel className="w-4 h-4" />
                Export Excel
              </button>
            </div>
          </div>
        )}
      </Modal>

      {selectedCard && (
        <div className="hidden print:flex items-center justify-end gap-2 mt-4">
          <button
            onClick={() => handleExport(selectedCard)}
            className="btn-secondary inline-flex items-center gap-2"
          >
            <FaFileExcel className="w-4 h-4" />
            Export Excel
          </button>
        </div>
      )}

      <Modal isOpen={showBulkModal} onClose={() => { setShowBulkModal(false); setBulkForm({ classId: '', termId: '', academicYearId: '' }); }} title="Bulk Generate Report Cards" size="lg">
        <div className="space-y-4">
          <div>
            <label className="label">Class</label>
            <select className="input-field" value={bulkForm.classId} onChange={(e) => setBulkForm((p) => ({ ...p, classId: e.target.value }))}>
              <option value="">Select Class</option>
              {classes.map((c) => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Term</label>
            <select className="input-field" value={bulkForm.termId} onChange={(e) => setBulkForm((p) => ({ ...p, termId: e.target.value }))}>
              <option value="">Select Term</option>
              {terms.map((t) => (
                <option key={t._id} value={t._id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Academic Year</label>
            <select className="input-field" value={bulkForm.academicYearId} onChange={(e) => setBulkForm((p) => ({ ...p, academicYearId: e.target.value }))}>
              <option value="">Select Academic Year</option>
              {academicYears.map((y) => (
                <option key={y._id} value={y._id}>{y.name}</option>
              ))}
            </select>
          </div>

          {bulkGenerating && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <FaSpinner className="w-4 h-4 animate-spin" />
                Generating report cards...
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${bulkProgress}%` }} />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-secondary" onClick={() => { setShowBulkModal(false); setBulkForm({ classId: '', termId: '', academicYearId: '' }); }}>
              Cancel
            </button>
            <button className="btn-primary" onClick={handleBulkGenerate} disabled={bulkGenerating}>
              {bulkGenerating ? (
                <span className="inline-flex items-center gap-2">
                  <FaSpinner className="w-4 h-4 animate-spin" />
                  Generating...
                </span>
              ) : 'Generate'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showSingleModal} onClose={() => { setShowSingleModal(false); setSingleForm({ studentId: '', termId: '', academicYearId: '' }); setStudentSearch(''); setStudents([]); }} title="Generate Report Card" size="lg">
        <div className="space-y-4">
          <div>
            <label className="label">Search Student</label>
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                className="input-field pl-10"
                placeholder="Search by name or admission number..."
                value={studentSearch}
                onChange={(e) => {
                  setStudentSearch(e.target.value);
                  fetchStudents(e.target.value);
                  setSingleForm((p) => ({ ...p, studentId: '' }));
                }}
              />
            </div>
            {studentsLoading && (
              <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
                <FaSpinner className="w-3 h-3 animate-spin" />
                Searching...
              </div>
            )}
            {students.length > 0 && !singleForm.studentId && (
              <div className="mt-2 border border-gray-200 dark:border-gray-700 rounded-lg max-h-48 overflow-y-auto">
                {students.map((s) => (
                  <button
                    key={s._id}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 text-sm flex items-center gap-3 border-b border-gray-100 dark:border-gray-700/50 last:border-0"
                    onClick={() => {
                      setSingleForm((p) => ({ ...p, studentId: s._id }));
                      setStudentSearch(s.fullName);
                      setStudents([]);
                    }}
                  >
                    <FaUserGraduate className="w-4 h-4 text-gray-400 shrink-0" />
                    <div>
                      <p className="text-gray-900 dark:text-white font-medium">{s.fullName}</p>
                      <p className="text-gray-500 dark:text-gray-400 text-xs">{s.admissionNumber} - {s.class?.name}{s.stream ? ` - ${s.stream.name}` : ''}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="label">Term</label>
            <select className="input-field" value={singleForm.termId} onChange={(e) => setSingleForm((p) => ({ ...p, termId: e.target.value }))}>
              <option value="">Select Term</option>
              {terms.map((t) => (
                <option key={t._id} value={t._id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Academic Year</label>
            <select className="input-field" value={singleForm.academicYearId} onChange={(e) => setSingleForm((p) => ({ ...p, academicYearId: e.target.value }))}>
              <option value="">Select Academic Year</option>
              {academicYears.map((y) => (
                <option key={y._id} value={y._id}>{y.name}</option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-secondary" onClick={() => { setShowSingleModal(false); setSingleForm({ studentId: '', termId: '', academicYearId: '' }); setStudentSearch(''); setStudents([]); }}>
              Cancel
            </button>
            <button className="btn-primary" onClick={handleSingleGenerate} disabled={singleGenerating}>
              {singleGenerating ? (
                <span className="inline-flex items-center gap-2">
                  <FaSpinner className="w-4 h-4 animate-spin" />
                  Generating...
                </span>
              ) : 'Generate'}
            </button>
          </div>
        </div>
      </Modal>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print\\:block, .print\\:block * { visibility: visible; }
          .print\\:block { position: absolute; left: 0; top: 0; width: 100%; }
          .print\\:flex { visibility: visible; }
        }
      `}</style>
    </div>
  );
}
