import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import type { Column } from '../../components/common/DataTable';
import type { Student, Class, Stream, StudentStatus, ApiResponse } from '../../types';
import { FaPlus, FaUpload, FaGraduationCap, FaEye, FaEdit, FaTrash, FaRedo, FaFileExcel, FaTimes, FaExclamationTriangle, FaMoneyBillWave, FaSearch, FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';

const statusOptions: { value: string; label: string }[] = [
  { value: '', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'graduated', label: 'Graduated' },
  { value: 'transferred', label: 'Transferred' },
  { value: 'archived', label: 'Archived' },
];

const statusBadgeClass: Record<string, string> = {
  active: 'badge-success',
  graduated: 'badge-info',
  transferred: 'badge-warning',
  archived: 'badge-danger',
};

function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${statusBadgeClass[status] || 'badge-info'}`}>{status}</span>;
}

function LoadingSkeleton() {
  return (
    <div className="card">
      <div className="animate-pulse space-y-4">
        <div className="flex gap-4">
          <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-lg flex-1" />
          <div className="h-10 w-32 bg-gray-200 dark:bg-gray-700 rounded-lg" />
          <div className="h-10 w-32 bg-gray-200 dark:bg-gray-700 rounded-lg" />
          <div className="h-10 w-32 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        </div>
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-lg w-80" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-12 bg-gray-100 dark:bg-gray-700/50 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="card flex flex-col items-center justify-center py-16 gap-4">
      <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
        <FaExclamationTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
      </div>
      <p className="text-lg font-medium text-gray-900 dark:text-white">Failed to load students</p>
      <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-md">{message}</p>
      <button onClick={onRetry} className="btn-primary flex items-center gap-2">
        <FaRedo className="w-4 h-4" />
        Try Again
      </button>
    </div>
  );
}

function EmptyState({ search, onClear }: { search: string; onClear: () => void }) {
  return (
    <div className="card flex flex-col items-center justify-center py-16 gap-3">
      <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
        <FaGraduationCap className="w-8 h-8 text-gray-400" />
      </div>
      <p className="text-lg font-medium text-gray-900 dark:text-white">
        {search ? 'No students match your search' : 'No students found'}
      </p>
      <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-sm">
        {search
          ? 'Try adjusting your search terms or filters.'
          : 'Get started by adding your first student.'}
      </p>
      {search ? (
        <button onClick={onClear} className="btn-secondary text-sm">
          Clear filters
        </button>
      ) : (
        <Link to="/students/new" className="btn-primary">
          <FaPlus className="w-4 h-4 mr-1" />
          Add Student
        </Link>
      )}
    </div>
  );
}

export default function StudentList() {
  const navigate = useNavigate();
  const { isHeadteacher, isClassTeacher, isAcademicTeacher } = useAuth();
  const canEditStudent = isHeadteacher || isClassTeacher || isAcademicTeacher;
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [streamFilter, setStreamFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const [classes, setClasses] = useState<Class[]>([]);
  const [streams, setStreams] = useState<Stream[]>([]);

  const [importOpen, setImportOpen] = useState(false);
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);

  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  const [promoteClass, setPromoteClass] = useState('');
  const [targetClass, setTargetClass] = useState('');
  const [promoting, setPromoting] = useState(false);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, string | number> = { page, limit };
      if (search.trim()) params.search = search.trim();
      if (classFilter) params.class = classFilter;
      if (streamFilter) params.stream = streamFilter;
      if (statusFilter) params.status = statusFilter;
      const res = await api.get('/students', { params });
      setStudents(res.data.data?.students || []);
      setTotal(res.data.data?.pagination?.total || 0);
      setTotalPages(res.data.data?.pagination?.pages || 0);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load students');
    } finally {
      setLoading(false);
    }
  }, [search, classFilter, streamFilter, statusFilter, page, limit]);

  useEffect(() => {
    api.get<ApiResponse<Class[]>>('/classes').then((res) => setClasses(res.data.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (classFilter) {
      api.get<ApiResponse<Stream[]>>('/streams', { params: { class: classFilter } })
        .then((res) => setStreams(res.data.data || []))
        .catch(() => setStreams([]));
    } else {
      setStreams([]);
      setStreamFilter('');
    }
  }, [classFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchStudents();
    }, 400);
    return () => clearTimeout(timer);
  }, [search, classFilter, streamFilter, statusFilter]);

  useEffect(() => {
    fetchStudents();
  }, [page, limit]);

  const handleClearFilters = () => {
    setSearch('');
    setClassFilter('');
    setStreamFilter('');
    setStatusFilter('');
    setPage(1);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/students/${deleteTarget._id}`);
      toast.success('Student deleted');
      setDeleteTarget(null);
      fetchStudents();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete student');
    }
  };

  const handleImport = async () => {
    if (!importFile) {
      toast.error('Please select a file');
      return;
    }
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', importFile);
      const res = await api.post('/students/bulk-import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const result = res.data.data;
      if (result.imported > 0) {
        toast.success(`Imported ${result.imported} student${result.imported > 1 ? 's' : ''}${result.skipped > 0 ? `, skipped ${result.skipped}` : ''}`);
      } else if (result.errors?.length > 0) {
        toast.error(`Import failed: ${result.errors[0].reason}`);
      } else {
        toast.error('No students were imported. Check your file format.');
      }
      if (result.imported > 0) {
        setImportOpen(false);
        setImportFile(null);
        setPage(1);
        fetchStudents();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const handlePromote = async () => {
    if (!promoteClass || !targetClass) {
      toast.error('Please select both current and target class');
      return;
    }
    setPromoting(true);
    try {
      await api.post('/students/promote', { fromClass: promoteClass, toClass: targetClass });
      toast.success('Students promoted successfully');
      setPromoteOpen(false);
      setPromoteClass('');
      setTargetClass('');
      fetchStudents();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Promotion failed');
    } finally {
      setPromoting(false);
    }
  };

  const columns: Column<Student>[] = [
    { key: 'admissionNumber', label: 'Admission No' },
    {
      key: 'fullName',
      label: 'Full Name',
      render: (s) => (
        <Link to={`/students/${s._id}`} className="text-primary-600 hover:underline font-medium">
          {s.fullName}
        </Link>
      ),
    },
    {
      key: 'gender',
      label: 'Gender',
      render: (s) => <span className="capitalize">{s.gender}</span>,
    },
    {
      key: 'class',
      label: 'Class',
      render: (s) => (typeof s.class === 'object' ? (s.class as any).name : s.class || '-'),
    },
    {
      key: 'stream',
      label: 'Stream',
      render: (s) => {
        if (!s.stream) return <span className="text-gray-400">-</span>;
        return typeof s.stream === 'object' ? (s.stream as any).name : s.stream;
      },
    },
    {
      key: 'feeBalance',
      label: 'Fee Balance',
      render: (s) => {
        const total = s.schoolFees?.totalFee ?? 0;
        const paid = s.schoolFees?.amountPaid ?? 0;
        const balance = total - paid;
        if (total === 0) return <span className="text-gray-400">-</span>;
        if (balance <= 0) return <span className="badge badge-success">PAID</span>;
        return (
          <span className="badge badge-danger">
            {new Intl.NumberFormat().format(balance)}
          </span>
        );
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (s) => <StatusBadge status={s.status} />,
    },
  ];

  const pageSizeOptions = [5, 10, 20, 50];

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">Students</h1>
        <div className="flex items-center gap-2">
          {isHeadteacher && (
            <>
              <button onClick={() => setPromoteOpen(true)} className="btn-secondary">
                <FaGraduationCap className="w-4 h-4 mr-1" />
                Promote
              </button>
              <button onClick={() => setImportOpen(true)} className="btn-secondary">
                <FaUpload className="w-4 h-4 mr-1" />
                Bulk Import
              </button>
            </>
          )}
          {canEditStudent && (
            <Link to="/students/new" className="btn-primary">
              <FaPlus className="w-4 h-4 mr-1" />
              Add Student
            </Link>
          )}
        </div>
      </div>

      {loading && students.length === 0 ? (
        <LoadingSkeleton />
      ) : error && students.length === 0 ? (
        <ErrorState message={error} onRetry={fetchStudents} />
      ) : (
        <>
          <div className="card">
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="relative flex-1">
                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name or admission number..."
                  className="input-field pl-10"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <select
                className="input-field sm:w-44"
                value={classFilter}
                onChange={(e) => { setClassFilter(e.target.value); setPage(1); }}
              >
                <option value="">All Classes</option>
                {classes.map((c) => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
              <select
                className="input-field sm:w-44"
                value={streamFilter}
                onChange={(e) => { setStreamFilter(e.target.value); setPage(1); }}
                disabled={!classFilter}
              >
                <option value="">All Streams</option>
                {streams.map((s) => (
                  <option key={s._id} value={s._id}>{s.name}</option>
                ))}
              </select>
              <select
                className="input-field sm:w-40"
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              >
                {statusOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <DataTable
              columns={columns}
              data={students}
              loading={false}
              searchable={false}
              sortable={false}
              onView={(s) => navigate(`/students/${s._id}`)}
              onEdit={canEditStudent ? (s) => navigate(`/students/new?id=${s._id}`) : undefined}
              onDelete={isHeadteacher ? (s) => setDeleteTarget(s) : undefined}
            />

            {total > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <span>Rows per page:</span>
                  <select
                    value={limit}
                    onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
                    className="input-field w-16 py-1"
                  >
                    {pageSizeOptions.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                  <span>{total} total</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <FaChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <FaChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {students.length === 0 && !loading && (
            <EmptyState search={search} onClear={handleClearFilters} />
          )}
        </>
      )}

      <Modal isOpen={importOpen} onClose={() => { setImportOpen(false); setImportFile(null); }} title="Bulk Import Students" size="lg">
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Upload a CSV or Excel file containing student data. Download a template to see the required format.
          </p>
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
              importFile
                ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/20'
                : 'border-gray-300 dark:border-gray-600 hover:border-primary-400 dark:hover:border-primary-500'
            }`}
            onClick={() => document.getElementById('import-file-input')?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files[0];
              if (file) setImportFile(file);
            }}
          >
            {importFile ? (
              <div className="flex flex-col items-center gap-2">
                <FaFileExcel className="w-10 h-10 text-primary-600 dark:text-primary-400" />
                <p className="text-sm font-medium text-gray-900 dark:text-white">{importFile.name}</p>
                <p className="text-xs text-gray-500">{(importFile.size / 1024).toFixed(1)} KB</p>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setImportFile(null); }}
                  className="text-xs text-red-600 hover:underline"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <FaUpload className="w-10 h-10 text-gray-400" />
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  Drop file here or click to browse
                </p>
                <p className="text-xs text-gray-500">Supports CSV, XLSX files</p>
              </div>
            )}
          </div>
          <input
            id="import-file-input"
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) setImportFile(e.target.files[0]);
            }}
          />
          <div className="flex items-center justify-between pt-2">
            <a
              href="/templates/student-import-template.csv"
              download
              className="text-sm text-primary-600 hover:underline flex items-center gap-1"
              onClick={(e) => { e.preventDefault(); toast('Template download not implemented'); }}
            >
              <FaFileExcel className="w-4 h-4" />
              Download template
            </a>
            <div className="flex gap-2">
              <button onClick={() => { setImportOpen(false); setImportFile(null); }} className="btn-secondary">
                Cancel
              </button>
              <button onClick={handleImport} className="btn-primary" disabled={!importFile || importing}>
                {importing ? 'Importing...' : 'Import'}
              </button>
            </div>
          </div>
        </div>
      </Modal>

      <Modal isOpen={promoteOpen} onClose={() => { setPromoteOpen(false); setPromoteClass(''); setTargetClass(''); }} title="Promote Students" size="md">
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Select the current class and the target class to promote all active students.
          </p>
          <div>
            <label className="label">Current Class</label>
            <select className="input-field" value={promoteClass} onChange={(e) => setPromoteClass(e.target.value)}>
              <option value="">Select class</option>
              {classes.map((c) => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Target Class</label>
            <select className="input-field" value={targetClass} onChange={(e) => setTargetClass(e.target.value)}>
              <option value="">Select target class</option>
              {classes.map((c) => (
                <option key={c._id} value={c._id} disabled={c._id === promoteClass}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => { setPromoteOpen(false); setPromoteClass(''); setTargetClass(''); }} className="btn-secondary">
              Cancel
            </button>
            <button onClick={handlePromote} className="btn-primary" disabled={!promoteClass || !targetClass || promoting}>
              {promoting ? 'Promoting...' : 'Promote'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Student"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Are you sure you want to delete <strong className="text-gray-900 dark:text-white">{deleteTarget?.fullName}</strong>?
            This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <button onClick={() => setDeleteTarget(null)} className="btn-secondary">
              Cancel
            </button>
            <button onClick={handleDelete} className="btn-danger">
              Delete
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
