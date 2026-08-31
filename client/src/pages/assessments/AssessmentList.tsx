import { useState, useEffect, useCallback } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import StatsCard from '../../components/common/StatsCard';
import { useAuth } from '../../context/AuthContext';
import type { Assessment, AssessmentType, Class, Subject, Stream, Term, ApiResponse } from '../../types';
import AssessmentForm from './AssessmentForm';
import DocumentsModal from './DocumentsModal';
import {
  FaPlus, FaBook, FaCheckCircle, FaFileAlt, FaTimesCircle, FaTrash, FaEdit, FaEye, FaFolderOpen,
} from 'react-icons/fa';

const assessmentTypeLabels: { value: AssessmentType; label: string }[] = [
  { value: 'assignment', label: 'Assignment' },
  { value: 'classExercise', label: 'Class Exercise' },
  { value: 'cat', label: 'CAT' },
  { value: 'project', label: 'Project' },
  { value: 'practical', label: 'Practical' },
  { value: 'midTerm', label: 'Mid Term' },
  { value: 'endTerm', label: 'End Term' },
  { value: 'finalExam', label: 'Final Exam' },
];

const statusColors: Record<string, string> = {
  draft: 'badge-warning',
  released: 'badge-info',
  published: 'badge-success',
  closed: 'badge-danger',
};

const typeColors: Record<AssessmentType, string> = {
  assignment: 'badge-info',
  classExercise: 'badge-primary',
  cat: 'badge-warning',
  project: 'badge-success',
  practical: 'badge-info',
  midTerm: 'badge-primary',
  endTerm: 'badge-danger',
  finalExam: 'badge-danger',
};

export default function AssessmentList() {
  const { isAcademicTeacher } = useAuth();
  const canManage = isAcademicTeacher;
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [streams, setStreams] = useState<Stream[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editAssessment, setEditAssessment] = useState<Assessment | null>(null);
  const [viewAssessment, setViewAssessment] = useState<Assessment | null>(null);
  const [stats, setStats] = useState({ total: 0, published: 0, draft: 0, released: 0 });
  const [downloading, setDownloading] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [showDocuments, setShowDocuments] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; errors: { row: number; reason: string }[] } | null>(null);
  const [uploadedDoc, setUploadedDoc] = useState<{ _id: string; filename: string; url: string; originalName: string; size: number } | null>(null);
  const [docMeta, setDocMeta] = useState({ class: '', subject: '', stream: '', term: '' });

  const [filters, setFilters] = useState({
    classId: '',
    subjectId: '',
    type: '' as AssessmentType | '',
    term: '',
    status: '' as 'draft' | 'published' | 'closed' | '',
  });

  const fetchMeta = useCallback(async () => {
    try {
      const [classesRes, subjectsRes, streamsRes, termsRes] = await Promise.all([
        api.get<ApiResponse<Class[]>>('/classes'),
        api.get<ApiResponse<Subject[]>>('/subjects'),
        api.get<ApiResponse<Stream[]>>('/streams'),
        api.get<ApiResponse<Term[]>>('/terms'),
      ]);
      setClasses(classesRes.data.data || []);
      setSubjects(subjectsRes.data.data || []);
      setStreams(streamsRes.data.data || []);
      setTerms(termsRes.data.data || []);
    } catch {
      // non-blocking
    }
  }, []);

  useEffect(() => {
    fetchMeta();
  }, [fetchMeta]);

  const fetchAssessments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (filters.classId) params.class = filters.classId;
      if (filters.subjectId) params.subject = filters.subjectId;
      if (filters.type) params.type = filters.type;
      if (filters.term) params.term = filters.term;
      if (filters.status) params.status = filters.status;

      const { data } = await api.get('/assessments', { params });
      const raw = data.data || {};
      const list = (Array.isArray(raw) ? raw : raw.assessments || []) as Assessment[];
      setAssessments(list);

      const total = list.length;
      const published = list.filter((a) => a.status === 'published').length;
      const draft = list.filter((a) => a.status === 'draft').length;
      const released = list.filter((a) => a.status === 'released').length;
      setStats({ total, published, draft, released });
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to load assessments';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchAssessments();
  }, [fetchAssessments]);

  const handleToggleStatus = async (assessment: Assessment) => {
    if (assessment.status === 'draft') {
      try {
        await api.put(`/assessments/${assessment._id}/release`);
        toast.success('Assessment released');
        fetchAssessments();
      } catch (err: any) {
        toast.error(err.response?.data?.message || 'Failed to release');
      }
      return;
    }
    const newStatus = assessment.status === 'published' ? 'closed' : 'published';
    try {
      await api.put(`/assessments/${assessment._id}`, { status: newStatus });
      toast.success(`Assessment ${newStatus === 'published' ? 'published' : 'closed'}`);
      fetchAssessments();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update status');
    }
  };

  const handleDelete = async (assessment: Assessment) => {
    if (!confirm(`Delete assessment "${assessment.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/assessments/${assessment._id}`);
      toast.success('Assessment deleted');
      fetchAssessments();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete');
    }
  };

  const handleEdit = (assessment: Assessment) => {
    setEditAssessment(assessment);
    setShowForm(true);
  };

  const handleDownload = async (url: string, filename: string) => {
    setDownloading(filename);
    try {
      const { data } = await api.get(url, { responseType: 'blob' });
      const blob = new Blob([data]);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Download failed');
    } finally {
      setDownloading(null);
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditAssessment(null);
  };

  const handleFormSuccess = () => {
    handleFormClose();
    fetchAssessments();
  };

  const renderClass = (a: Assessment) => {
    if (typeof a.class === 'object' && a.class) return (a.class as any).name || '-';
    return a.class || '-';
  };
  const renderSubject = (a: Assessment) => {
    if (typeof a.subject === 'object' && a.subject) return (a.subject as any).name || '-';
    return a.subject || '-';
  };

  const columns = [
    { key: 'name', label: 'Name', sortable: true },
    {
      key: 'type',
      label: 'Type',
      render: (a: Assessment) => (
        <span className={`badge ${typeColors[a.type]}`}>
          {assessmentTypeLabels.find((t) => t.value === a.type)?.label || a.type}
        </span>
      ),
      sortable: true,
    },
    {
      key: 'class',
      label: 'Class',
      render: renderClass,
      sortable: true,
    },
    {
      key: 'subject',
      label: 'Subject',
      render: renderSubject,
      sortable: true,
    },
    {
      key: 'examDate',
      label: 'Exam Date',
      render: (a: Assessment) => <span>{a.examDate ? new Date(a.examDate).toLocaleDateString() : '-'}</span>,
      sortable: true,
    },
    {
      key: 'releaseDate',
      label: 'Release Date',
      render: (a: Assessment) => <span>{a.releaseDate ? new Date(a.releaseDate).toLocaleDateString() : '-'}</span>,
      sortable: true,
    },
    { key: 'maxScore', label: 'Max Score', sortable: true },
    { key: 'weight', label: 'Weight %', sortable: true, render: (a: Assessment) => <span>{a.weight}%</span> },
    {
      key: 'status',
      label: 'Status',
      render: (a: Assessment) => (
        <span className={`badge ${statusColors[a.status]}`}>
          {a.status.charAt(0).toUpperCase() + a.status.slice(1)}
        </span>
      ),
      sortable: true,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">Assessments</h1>
        <div className="flex items-center gap-2">
          <button className="btn-secondary" onClick={() => { setShowDocuments(true); }}>
            <FaFolderOpen className="w-4 h-4 mr-1" />
            Documents
          </button>
          {canManage && (
            <>
              <button className="btn-secondary" onClick={() => { setImportResult(null); setImportFile(null); setUploadedDoc(null); setDocMeta({ class: '', subject: '', stream: '', term: '' }); setShowImport(true); }}>
                <FaPlus className="w-4 h-4 mr-1" />
                Import
              </button>
              <button className="btn-secondary" onClick={() => handleDownload('/assessments/template', `assessment-template.xlsx`)} disabled={downloading === 'template.xlsx'}>
                <FaFileAlt className="w-4 h-4 mr-1" />
                {downloading === 'template.xlsx' ? '...' : 'Template'}
              </button>
              <button className="btn-secondary" onClick={() => handleDownload('/assessments/export', `assessments-export.xlsx`)} disabled={downloading === 'export.xlsx'}>
                <FaFileAlt className="w-4 h-4 mr-1" />
                {downloading === 'export.xlsx' ? '...' : 'Export'}
              </button>
              <button className="btn-primary" onClick={() => setShowForm(true)}>
                <FaBook className="w-4 h-4 mr-1" />
                Create Assessment
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Total Assessments" value={stats.total} icon={<FaBook className="w-5 h-5" />} color="blue" />
        <StatsCard title="Draft" value={stats.draft} icon={<FaFileAlt className="w-5 h-5" />} color="yellow" />
        <StatsCard title="Released" value={stats.released} icon={<FaCheckCircle className="w-5 h-5" />} color="blue" />
        <StatsCard title="Published" value={stats.published} icon={<FaCheckCircle className="w-5 h-5" />} color="green" />
      </div>

      <div className="card">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
          <div>
            <label className="label">Class</label>
            <select className="input-field" value={filters.classId} onChange={(e) => setFilters((p) => ({ ...p, classId: e.target.value }))}>
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
            <label className="label">Type</label>
            <select className="input-field" value={filters.type} onChange={(e) => setFilters((p) => ({ ...p, type: e.target.value as AssessmentType }))}>
              <option value="">All Types</option>
              {assessmentTypeLabels.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Term</label>
            <input type="text" className="input-field" placeholder="e.g. Term 1" value={filters.term} onChange={(e) => setFilters((p) => ({ ...p, term: e.target.value }))} />
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input-field" value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value as any }))}>
              <option value="">All Status</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="closed">Closed</option>
            </select>
          </div>
        </div>

        {error && !loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="text-red-500 dark:text-red-400 mb-2">
              <FaTimesCircle className="w-12 h-12 mx-auto" />
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
            <button onClick={fetchAssessments} className="btn-primary">Retry</button>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={assessments.map((a) => ({
              ...a,
              className: typeof a.class === 'object' ? (a as any).className || (a as any).class?.name || a.class : a.class,
              subjectName: typeof a.subject === 'object' ? (a as any).subjectName || (a as any).subject?.name || a.subject : a.subject,
            }))}
            loading={loading}
            onView={(a) => setViewAssessment(a)}
            onEdit={canManage ? handleEdit : undefined}
            onDelete={canManage ? handleDelete : undefined}
          />
        )}
      </div>

      <AssessmentForm
        isOpen={showForm}
        onClose={handleFormClose}
        onSuccess={handleFormSuccess}
        assessment={editAssessment}
      />

      <Modal isOpen={!!viewAssessment} onClose={() => setViewAssessment(null)} title="Assessment Details" size="lg">
        {viewAssessment && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Name</label>
                <p className="text-gray-900 dark:text-white font-medium">{viewAssessment.name}</p>
              </div>
              <div>
                <label className="label">Code</label>
                <p className="text-gray-900 dark:text-white">{viewAssessment.code}</p>
              </div>
              <div>
                <label className="label">Type</label>
                <p className="text-gray-900 dark:text-white">
                  {assessmentTypeLabels.find((t) => t.value === viewAssessment.type)?.label || viewAssessment.type}
                </p>
              </div>
              <div>
                <label className="label">Status</label>
                <span className={`badge ${statusColors[viewAssessment.status]}`}>
                  {viewAssessment.status.charAt(0).toUpperCase() + viewAssessment.status.slice(1)}
                </span>
              </div>
              <div>
                <label className="label">Class</label>
                <p className="text-gray-900 dark:text-white">{renderClass(viewAssessment)}</p>
              </div>
              <div>
                <label className="label">Subject</label>
                <p className="text-gray-900 dark:text-white">{renderSubject(viewAssessment)}</p>
              </div>
              {viewAssessment.stream && (
                <div>
                  <label className="label">Stream</label>
                  <p className="text-gray-900 dark:text-white">{typeof viewAssessment.stream === 'object' ? (viewAssessment.stream as any).name || viewAssessment.stream : viewAssessment.stream}</p>
                </div>
              )}
              <div>
                <label className="label">Max Score</label>
                <p className="text-gray-900 dark:text-white">{viewAssessment.maxScore}</p>
              </div>
              <div>
                <label className="label">Weight</label>
                <p className="text-gray-900 dark:text-white">{viewAssessment.weight}%</p>
              </div>
              {viewAssessment.examDate && (
                <div>
                  <label className="label">Exam Date</label>
                  <p className="text-gray-900 dark:text-white">{new Date(viewAssessment.examDate).toLocaleDateString()}</p>
                </div>
              )}
              {viewAssessment.releaseDate && (
                <div>
                  <label className="label">Release Date</label>
                  <p className="text-gray-900 dark:text-white">{new Date(viewAssessment.releaseDate).toLocaleDateString()}</p>
                </div>
              )}
              {viewAssessment.duration && (
                <div>
                  <label className="label">Duration</label>
                  <p className="text-gray-900 dark:text-white">{viewAssessment.duration} minutes</p>
                </div>
              )}
              <div>
                <label className="label">Required</label>
                <p className="text-gray-900 dark:text-white">{viewAssessment.isRequired ? 'Yes' : 'No'}</p>
              </div>
            </div>
            {viewAssessment.instructions && (
              <div>
                <label className="label">Instructions</label>
                <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{viewAssessment.instructions}</p>
              </div>
            )}
            <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                className="btn-secondary"
                onClick={() => handleDownload(`/assessments/${viewAssessment._id}/download`, `${viewAssessment.name || 'assessment'}.pdf`)}
                disabled={downloading === 'download'}
              >
                <FaFileAlt className="w-4 h-4 mr-1" />
                {downloading === 'download' ? '...' : 'Download'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={showImport} onClose={() => setShowImport(false)} title="Import Assessments" size="md">
        {uploadedDoc ? (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20">
              <p className="font-medium text-gray-900 dark:text-white">Document uploaded successfully</p>
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 break-all">
                {uploadedDoc.originalName} ({(uploadedDoc.size / 1024).toFixed(1)} KB)
              </p>
              {(uploadedDoc as any).class && (
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                  Target: {(uploadedDoc as any).class?.name} · {(uploadedDoc as any).subject?.name}
                  {(uploadedDoc as any).stream?.name ? ` · ${(uploadedDoc as any).stream.name}` : ''}
                </p>
              )}
            </div>
            <div className="flex justify-end gap-3">
              <button
                className="btn-secondary"
                onClick={() => handleDownload(`/exam-documents/${uploadedDoc._id}/download`, uploadedDoc.originalName)}
                disabled={downloading === uploadedDoc.originalName}
              >
                {downloading === uploadedDoc.originalName ? 'Downloading...' : 'Download Document'}
              </button>
              <button
                className="btn-primary"
                onClick={() => { setShowImport(false); setUploadedDoc(null); setImportFile(null); setDocMeta({ class: '', subject: '', stream: '', term: '' }); }}
              >
                Done
              </button>
            </div>
          </div>
        ) : importResult ? (
          <div className="space-y-4">
            <div className={`p-4 rounded-lg ${importResult.skipped === 0 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-yellow-50 dark:bg-yellow-900/20'}`}>
              <p className="font-medium text-gray-900 dark:text-white">
                Imported: {importResult.imported} | Skipped: {importResult.skipped}
              </p>
            </div>
            {importResult.errors.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Errors</h4>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {importResult.errors.map((e, i) => (
                    <p key={i} className="text-sm text-red-600 dark:text-red-400">
                      Row {e.row}: {e.reason}
                    </p>
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-end">
              <button className="btn-primary" onClick={() => { setShowImport(false); setImportResult(null); fetchAssessments(); }}>
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={async (e) => {
            e.preventDefault();
            if (!importFile) return;
            setImporting(true);
            const isDoc = /\.(doc|docx|pdf)$/i.test(importFile.name);
            const formData = new FormData();
            formData.append('file', importFile);
            try {
              if (isDoc) {
                if (!docMeta.class || !docMeta.subject) {
                  toast.error('Target class and subject are required for documents');
                  setImporting(false);
                  return;
                }
                formData.append('class', docMeta.class);
                formData.append('subject', docMeta.subject);
                if (docMeta.stream) formData.append('stream', docMeta.stream);
                if (docMeta.term) formData.append('term', docMeta.term);
                const { data } = await api.post('/exam-documents', formData, {
                  headers: { 'Content-Type': 'multipart/form-data' },
                });
                setUploadedDoc({ ...data.data, url: `/exam-documents/${data.data._id}/download` });
                toast.success(data.message);
              } else {
                const { data } = await api.post('/assessments/import', formData, {
                  headers: { 'Content-Type': 'multipart/form-data' },
                });
                setImportResult(data.data);
                if (data.data.imported > 0) toast.success(data.message);
              }
            } catch (err: any) {
              toast.error(err.response?.data?.message || 'Import failed');
            } finally {
              setImporting(false);
            }
          }} className="space-y-4">
            <div>
              <label className="label">Upload Document (Excel/CSV/Word/PDF)</label>
              <input
                type="file"
                accept=".xlsx,.xls,.xlsb,.ods,.csv,.tsv,.txt,.doc,.docx,.pdf"
                className="input-field"
                onChange={(e) => { setImportFile(e.target.files?.[0] || null); setUploadedDoc(null); }}
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Excel/CSV files are imported as assessments (download the template first). Word (.doc/.docx) and PDF files are stored as exam documents restricted to teachers assigned to the target class and subject.
              </p>
            </div>
            {importFile && /\.(doc|docx|pdf)$/i.test(importFile.name) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                <div>
                  <label className="label">Target Class *</label>
                  <select className="input-field" value={docMeta.class} onChange={(e) => setDocMeta((p) => ({ ...p, class: e.target.value }))} required>
                    <option value="">Select class</option>
                    {classes.map((c) => (
                      <option key={c._id} value={c._id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Target Subject *</label>
                  <select className="input-field" value={docMeta.subject} onChange={(e) => setDocMeta((p) => ({ ...p, subject: e.target.value }))} required>
                    <option value="">Select subject</option>
                    {subjects.map((s) => (
                      <option key={s._id} value={s._id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Stream (optional)</label>
                  <select className="input-field" value={docMeta.stream} onChange={(e) => setDocMeta((p) => ({ ...p, stream: e.target.value }))}>
                    <option value="">All streams</option>
                    {streams.map((s) => (
                      <option key={s._id} value={s._id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Term (optional)</label>
                  <select className="input-field" value={docMeta.term} onChange={(e) => setDocMeta((p) => ({ ...p, term: e.target.value }))}>
                    <option value="">All terms</option>
                    {terms.map((t) => (
                      <option key={t._id} value={t._id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
            <div className="flex items-center justify-end gap-3">
              <button type="button" className="btn-secondary" onClick={() => setShowImport(false)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={!importFile || importing}>
                {importing ? 'Importing...' : importFile && /\.(doc|docx|pdf)$/i.test(importFile.name) ? 'Upload Document' : 'Import'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <Modal isOpen={showDocuments} onClose={() => setShowDocuments(false)} title="Exam Documents" size="lg">
        <DocumentsModal
          onClose={() => setShowDocuments(false)}
          onDeleted={() => { /* list refreshes internally */ }}
        />
      </Modal>
    </div>
  );
}