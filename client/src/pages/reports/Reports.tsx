import { useState, useEffect, useCallback } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import {
  FaCalendarAlt, FaChartLine, FaChartBar, FaChartPie, FaFileExcel,
  FaFilePdf, FaRedo, FaExclamationTriangle, FaSpinner, FaSearch, FaTrophy,
  FaArrowDown, FaClock, FaCheckCircle,
} from 'react-icons/fa';
import { LineChart, BarChart, PieChart } from '../../components/charts/Charts';
import DataTable from '../../components/common/DataTable';
import type { Class, Subject, Term, AcademicYear, Stream, Attendance, Student, ApiResponse } from '../../types';

type TabType = 'attendance' | 'performance' | 'analytics';

interface Tab {
  id: TabType;
  label: string;
  icon: typeof FaCalendarAlt;
}

const TABS: Tab[] = [
  { id: 'attendance', label: 'Attendance Reports', icon: FaCalendarAlt },
  { id: 'performance', label: 'Performance Reports', icon: FaChartLine },
  { id: 'analytics', label: 'Analytics', icon: FaChartBar },
];

type AttendanceReportType = 'daily' | 'weekly' | 'monthly' | 'term' | 'annual';
type PerformanceReportType = 'classPerformance' | 'subjectPerformance' | 'gradeAnalysis' | 'ranking';

const ATTENDANCE_TYPES: { value: AttendanceReportType; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'term', label: 'Term' },
  { value: 'annual', label: 'Annual' },
];

const PERFORMANCE_TYPES: { value: PerformanceReportType; label: string }[] = [
  { value: 'classPerformance', label: 'Class Performance' },
  { value: 'subjectPerformance', label: 'Subject Performance' },
  { value: 'gradeAnalysis', label: 'Grade Analysis' },
  { value: 'ranking', label: 'Ranking' },
];

interface AttendanceReportData {
  summary: {
    totalDays: number;
    averagePercentage: number;
    totalPresent: number;
    totalAbsent: number;
    totalExcused: number;
  };
  records: AttendanceRecord[];
  trend: { date: string; percentage: number }[];
}

interface AttendanceRecord {
  _id: string;
  date: string;
  className: string;
  present: number;
  absent: number;
  total: number;
  percentage: number;
}

interface PerformanceReportData {
  classComparison: { className: string; average: number }[];
  gradeDistribution: { grade: string; count: number; color: string }[];
  subjectAverages: { subject: string; average: number }[];
  rankings: { _id: string; studentName: string; admissionNumber: string; className: string; average: number; grade: string; position: number }[];
}

interface AnalyticsData {
  attendanceVsPerformance: { student: string; attendance: number; performance: number }[];
  subjectComparison: { subject: string; average: number; maxScore: number }[];
  gradeOverTime: { term: string; gradeDistribution: { grade: string; count: number; color: string }[] }[];
  topPerformers: { _id: string; studentName: string; average: number; grade: string }[];
  bottomPerformers: { _id: string; studentName: string; average: number; grade: string }[];
}

function LoadingSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-lg w-48" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-xl" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 bg-gray-100 dark:bg-gray-700/50 rounded-lg" />
      ))}
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <FaExclamationTriangle className="w-12 h-12 text-red-500 dark:text-red-400 mb-3" />
      <p className="text-lg font-medium text-gray-900 dark:text-white mb-1">Failed to load report</p>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 max-w-md">{message}</p>
      <button onClick={onRetry} className="btn-primary inline-flex items-center gap-2">
        <FaRedo className="w-4 h-4" />
        Try Again
      </button>
    </div>
  );
}

function EmptyState({ message, icon }: { message: string; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {icon || <FaSearch className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" />}
      <p className="text-gray-500 dark:text-gray-400 text-sm">{message}</p>
    </div>
  );
}

interface FilterBarProps {
  children: React.ReactNode;
  onGenerate: () => void;
  loading: boolean;
}

function FilterBar({ children, onGenerate, loading }: FilterBarProps) {
  return (
    <div className="card">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
        {children}
      </div>
      <button onClick={onGenerate} disabled={loading} className="btn-primary inline-flex items-center gap-2">
        {loading ? (
          <>
            <FaSpinner className="w-4 h-4 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <FaSearch className="w-4 h-4" />
            Generate Report
          </>
        )}
      </button>
    </div>
  );
}

function AttendanceTab() {
  const [reportType, setReportType] = useState<AttendanceReportType>('daily');
  const [filters, setFilters] = useState({ classId: '', streamId: '', fromDate: '', toDate: '' });
  const [classes, setClasses] = useState<Class[]>([]);
  const [streams, setStreams] = useState<Stream[]>([]);
  const [data, setData] = useState<AttendanceReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState(false);

  useEffect(() => {
    api.get<ApiResponse<Class[]>>('/classes').then((res) => setClasses(res.data.data || [])).catch(() => {});
  }, []);

  const fetchStreams = useCallback(async (classId: string) => {
    if (!classId) { setStreams([]); return; }
    try {
      const res = await api.get<ApiResponse<Stream[]>>(`/classes/${classId}/streams`);
      setStreams(res.data.data || []);
    } catch { setStreams([]); }
  }, []);

  useEffect(() => { fetchStreams(filters.classId); }, [filters.classId, fetchStreams]);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setGenerated(true);
    try {
      const params: Record<string, string> = { type: reportType };
      if (filters.classId) params.class = filters.classId;
      if (filters.streamId) params.stream = filters.streamId;
      if (filters.fromDate) params.fromDate = filters.fromDate;
      if (filters.toDate) params.toDate = filters.toDate;
      const res = await api.get('/reports/attendance', { params });
      setData(res.data.data || res.data);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to generate attendance report';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format: 'pdf' | 'excel') => {
    try {
      const params: Record<string, string> = { type: reportType, format };
      if (filters.classId) params.class = filters.classId;
      if (filters.streamId) params.stream = filters.streamId;
      if (filters.fromDate) params.fromDate = filters.fromDate;
      if (filters.toDate) params.toDate = filters.toDate;
      const res = await api.get('/reports/attendance/export', { params, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `attendance-report.${format === 'pdf' ? 'pdf' : 'xlsx'}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`Attendance report exported as ${format.toUpperCase()}`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to export');
    }
  };

  const trendData = data?.trend ? {
    labels: data.trend.map((t) => {
      const d = new Date(t.date);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }),
    datasets: [{
      label: 'Attendance %',
      data: data.trend.map((t) => t.percentage),
      borderColor: '#3b82f6',
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      fill: true,
      tension: 0.4,
      pointRadius: 3,
      pointHoverRadius: 5,
    }],
  } : null;

  const attendanceColumns = [
    { key: 'date', label: 'Date', sortable: true, render: (r: AttendanceRecord) => new Date(r.date).toLocaleDateString() },
    { key: 'className', label: 'Class', sortable: true },
    { key: 'present', label: 'Present', sortable: true },
    { key: 'absent', label: 'Absent', sortable: true, render: (r: AttendanceRecord) => <span className="text-red-600 dark:text-red-400">{r.absent}</span> },
    { key: 'total', label: 'Total', sortable: true },
    {
      key: 'percentage',
      label: '%',
      sortable: true,
      render: (r: AttendanceRecord) => (
        <span className={`font-medium ${r.percentage >= 90 ? 'text-green-600' : r.percentage >= 75 ? 'text-yellow-600' : 'text-red-600'}`}>
          {r.percentage?.toFixed(1)}%
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <FilterBar onGenerate={handleGenerate} loading={loading}>
        <div>
          <label className="label">Report Type</label>
          <select className="input-field" value={reportType} onChange={(e) => setReportType(e.target.value as AttendanceReportType)}>
            {ATTENDANCE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Class</label>
          <select className="input-field" value={filters.classId} onChange={(e) => setFilters((p) => ({ ...p, classId: e.target.value, streamId: '' }))}>
            <option value="">All Classes</option>
            {classes.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Stream</label>
          <select className="input-field" value={filters.streamId} onChange={(e) => setFilters((p) => ({ ...p, streamId: e.target.value }))}>
            <option value="">All Streams</option>
            {streams.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">From Date</label>
          <input type="date" className="input-field" value={filters.fromDate} onChange={(e) => setFilters((p) => ({ ...p, fromDate: e.target.value }))} />
        </div>
        <div>
          <label className="label">To Date</label>
          <input type="date" className="input-field" value={filters.toDate} onChange={(e) => setFilters((p) => ({ ...p, toDate: e.target.value }))} />
        </div>
      </FilterBar>

      {error && <ErrorState message={error} onRetry={handleGenerate} />}

      {!generated && !loading && !error && (
        <EmptyState message="Select filters and click Generate Report to view attendance data" icon={<FaCalendarAlt className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-3" />} />
      )}

      {loading && <LoadingSkeleton rows={4} />}

      {generated && !loading && !error && data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="stat-card">
              <div className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0 bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-sm">
                <FaClock className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{data.summary.totalDays}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Total Days</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0 bg-gradient-to-br from-green-500 to-green-600 text-white shadow-sm">
                <FaCheckCircle className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{data.summary.totalPresent}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Total Present</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0 bg-gradient-to-br from-purple-500 to-purple-600 text-white shadow-sm">
                <FaChartLine className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{data.summary.averagePercentage?.toFixed(1)}%</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Avg Attendance</p>
              </div>
            </div>
          </div>

          {trendData && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 uppercase tracking-wide flex items-center gap-2">
                <FaChartLine className="w-4 h-4" />
                Attendance Trend
              </h3>
              <LineChart data={trendData as any} height={280} />
            </div>
          )}

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Attendance Records</h3>
              <div className="flex items-center gap-2">
                <button onClick={() => handleExport('pdf')} className="btn-secondary inline-flex items-center gap-1 text-xs px-3 py-1.5">
                  <FaFilePdf className="w-3 h-3" /> PDF
                </button>
                <button onClick={() => handleExport('excel')} className="btn-secondary inline-flex items-center gap-1 text-xs px-3 py-1.5">
                  <FaFileExcel className="w-3 h-3" /> Excel
                </button>
              </div>
            </div>
            {data.records.length > 0 ? (
              <DataTable columns={attendanceColumns} data={data.records} searchable={false} sortable={true} />
            ) : (
              <EmptyState message="No attendance records found for the selected filters" />
            )}
          </div>
        </>
      )}
    </div>
  );
}

function PerformanceTab() {
  const [reportType, setReportType] = useState<PerformanceReportType>('classPerformance');
  const [filters, setFilters] = useState({ classId: '', subjectId: '', termId: '', academicYearId: '' });
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [data, setData] = useState<PerformanceReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get<ApiResponse<Class[]>>('/classes'),
      api.get<ApiResponse<Subject[]>>('/subjects'),
      api.get<ApiResponse<Term[]>>('/terms'),
      api.get<ApiResponse<AcademicYear[]>>('/academic-years'),
    ]).then(([c, s, t, y]) => {
      setClasses(c.data.data || []);
      setSubjects(s.data.data || []);
      setTerms(t.data.data || []);
      setAcademicYears(y.data.data || []);
    }).catch(() => {});
  }, []);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setGenerated(true);
    try {
      const params: Record<string, string> = { type: reportType };
      if (filters.classId) params.class = filters.classId;
      if (filters.subjectId) params.subject = filters.subjectId;
      if (filters.termId) params.term = filters.termId;
      if (filters.academicYearId) params.academicYear = filters.academicYearId;
      const res = await api.get('/reports/performance', { params });
      setData(res.data.data || res.data);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to generate performance report';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format: 'pdf' | 'excel') => {
    try {
      const params: Record<string, string> = { type: reportType, format };
      if (filters.classId) params.class = filters.classId;
      if (filters.subjectId) params.subject = filters.subjectId;
      if (filters.termId) params.term = filters.termId;
      if (filters.academicYearId) params.academicYear = filters.academicYearId;
      const res = await api.get('/reports/performance/export', { params, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `performance-report.${format === 'pdf' ? 'pdf' : 'xlsx'}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`Performance report exported as ${format.toUpperCase()}`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to export');
    }
  };

  const classComparisonChart = data?.classComparison ? {
    labels: data.classComparison.map((c) => c.className),
    datasets: [{
      label: 'Average Score',
      data: data.classComparison.map((c) => c.average),
      backgroundColor: ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'],
      borderRadius: 4,
    }],
  } : null;

  const gradePieChart = data?.gradeDistribution ? {
    labels: data.gradeDistribution.map((g) => g.grade),
    datasets: [{
      label: 'Students',
      data: data.gradeDistribution.map((g) => g.count),
      backgroundColor: data.gradeDistribution.map((g) => g.color),
      borderWidth: 2,
      borderColor: '#ffffff',
    }],
  } : null;

  const subjectChart = data?.subjectAverages ? {
    labels: data.subjectAverages.map((s) => s.subject),
    datasets: [{
      label: 'Average Score',
      data: data.subjectAverages.map((s) => s.average),
      backgroundColor: '#3b82f6',
      borderRadius: 4,
    }],
  } : null;

  const rankingColumns = [
    { key: 'position', label: '#', sortable: true },
    { key: 'studentName', label: 'Name', sortable: true },
    { key: 'admissionNumber', label: 'Admission No' },
    { key: 'className', label: 'Class' },
    {
      key: 'average',
      label: 'Average',
      sortable: true,
      render: (r: any) => (
        <span className={`font-medium ${r.average >= 80 ? 'text-green-600' : r.average >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
          {r.average?.toFixed(1)}
        </span>
      ),
    },
    {
      key: 'grade',
      label: 'Grade',
      render: (r: any) => (
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-bold">
          {r.grade || '-'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <FilterBar onGenerate={handleGenerate} loading={loading}>
        <div>
          <label className="label">Report Type</label>
          <select className="input-field" value={reportType} onChange={(e) => setReportType(e.target.value as PerformanceReportType)}>
            {PERFORMANCE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Class</label>
          <select className="input-field" value={filters.classId} onChange={(e) => setFilters((p) => ({ ...p, classId: e.target.value }))}>
            <option value="">All Classes</option>
            {classes.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Subject</label>
          <select className="input-field" value={filters.subjectId} onChange={(e) => setFilters((p) => ({ ...p, subjectId: e.target.value }))}>
            <option value="">All Subjects</option>
            {subjects.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Term</label>
          <select className="input-field" value={filters.termId} onChange={(e) => setFilters((p) => ({ ...p, termId: e.target.value }))}>
            <option value="">All Terms</option>
            {terms.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Academic Year</label>
          <select className="input-field" value={filters.academicYearId} onChange={(e) => setFilters((p) => ({ ...p, academicYearId: e.target.value }))}>
            <option value="">All Years</option>
            {academicYears.map((y) => <option key={y._id} value={y._id}>{y.name}</option>)}
          </select>
        </div>
      </FilterBar>

      {error && <ErrorState message={error} onRetry={handleGenerate} />}

      {!generated && !loading && !error && (
        <EmptyState message="Select filters and click Generate Report to view performance data" icon={<FaChartLine className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-3" />} />
      )}

      {loading && <LoadingSkeleton rows={4} />}

      {generated && !loading && !error && data && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {(reportType === 'classPerformance' || reportType === 'subjectPerformance') && classComparisonChart && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 uppercase tracking-wide flex items-center gap-2">
                  <FaChartBar className="w-4 h-4" />
                  {reportType === 'classPerformance' ? 'Class Comparison' : 'Subject Performance'}
                </h3>
                <BarChart data={classComparisonChart as any} height={280} />
              </div>
            )}

            {reportType === 'gradeAnalysis' && gradePieChart && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 uppercase tracking-wide flex items-center gap-2">
                  <FaChartPie className="w-4 h-4" />
                  Grade Distribution
                </h3>
                <div className="flex justify-center">
                  <div className="w-72">
                    <PieChart data={gradePieChart as any} height={280} />
                  </div>
                </div>
              </div>
            )}

            {subjectChart && (reportType === 'subjectPerformance') && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 uppercase tracking-wide flex items-center gap-2">
                  <FaChartBar className="w-4 h-4" />
                  Subject Averages
                </h3>
                <BarChart data={subjectChart as any} height={280} />
              </div>
            )}
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                {reportType === 'ranking' ? 'Student Rankings' : reportType === 'gradeAnalysis' ? 'Grade Distribution Details' : 'Performance Details'}
              </h3>
              <div className="flex items-center gap-2">
                <button onClick={() => handleExport('pdf')} className="btn-secondary inline-flex items-center gap-1 text-xs px-3 py-1.5">
                  <FaFilePdf className="w-3 h-3" /> PDF
                </button>
                <button onClick={() => handleExport('excel')} className="btn-secondary inline-flex items-center gap-1 text-xs px-3 py-1.5">
                  <FaFileExcel className="w-3 h-3" /> Excel
                </button>
              </div>
            </div>
            {data.rankings && data.rankings.length > 0 ? (
              <DataTable columns={rankingColumns} data={data.rankings} searchable={true} sortable={true} />
            ) : (
              <EmptyState message="No performance data found for the selected filters" />
            )}
          </div>
        </>
      )}
    </div>
  );
}

function AnalyticsTab() {
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [filters, setFilters] = useState({ academicYearId: '', termId: '' });
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get<ApiResponse<AcademicYear[]>>('/academic-years'),
      api.get<ApiResponse<Term[]>>('/terms'),
    ]).then(([y, t]) => {
      setAcademicYears(y.data.data || []);
      setTerms(t.data.data || []);
    }).catch(() => {});
  }, []);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setGenerated(true);
    try {
      const params: Record<string, string> = {};
      if (filters.academicYearId) params.academicYear = filters.academicYearId;
      if (filters.termId) params.term = filters.termId;
      const res = await api.get('/reports/analytics', { params });
      setData(res.data.data || res.data);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to load analytics';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const scatterData = data?.attendanceVsPerformance ? {
    labels: data.attendanceVsPerformance.map((d) => d.student),
    datasets: [
      {
        label: 'Attendance %',
        data: data.attendanceVsPerformance.map((d) => d.attendance),
        borderColor: '#22c55e',
        backgroundColor: 'rgba(34, 197, 94, 0.5)',
        pointRadius: 4,
        pointHoverRadius: 6,
      },
      {
        label: 'Performance %',
        data: data.attendanceVsPerformance.map((d) => d.performance),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.5)',
        pointRadius: 4,
        pointHoverRadius: 6,
      },
    ],
  } : null;

  const subjectCompData = data?.subjectComparison ? {
    labels: data.subjectComparison.map((s) => s.subject),
    datasets: [{
      label: 'Average Score',
      data: data.subjectComparison.map((s) => s.average),
      backgroundColor: '#8b5cf6',
      borderRadius: 4,
    }],
  } : null;

  const gradeOverTimeData = data?.gradeOverTime && data.gradeOverTime.length > 0 ? {
    labels: data.gradeOverTime.map((g) => g.term),
    datasets: data.gradeOverTime[0].gradeDistribution.map((_, gradeIdx) => ({
      label: data.gradeOverTime[0].gradeDistribution[gradeIdx].grade,
      data: data.gradeOverTime.map((term) => {
        const dist = term.gradeDistribution.find((_, i) => i === gradeIdx);
        return dist ? dist.count : 0;
      }),
      backgroundColor: data.gradeOverTime[0].gradeDistribution[gradeIdx].color,
      borderRadius: 4,
    })),
  } : null;

  const topColumns = [
    { key: 'studentName', label: 'Name', sortable: true },
    { key: 'average', label: 'Average', sortable: true, render: (r: any) => <span className="font-semibold text-green-600">{r.average?.toFixed(1)}</span> },
    { key: 'grade', label: 'Grade' },
  ];

  const bottomColumns = [
    { key: 'studentName', label: 'Name', sortable: true },
    { key: 'average', label: 'Average', sortable: true, render: (r: any) => <span className="font-semibold text-red-600">{r.average?.toFixed(1)}</span> },
    { key: 'grade', label: 'Grade' },
  ];

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          <div>
            <label className="label">Academic Year</label>
            <select className="input-field" value={filters.academicYearId} onChange={(e) => setFilters((p) => ({ ...p, academicYearId: e.target.value }))}>
              <option value="">All Years</option>
              {academicYears.map((y) => <option key={y._id} value={y._id}>{y.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Term</label>
            <select className="input-field" value={filters.termId} onChange={(e) => setFilters((p) => ({ ...p, termId: e.target.value }))}>
              <option value="">All Terms</option>
              {terms.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={handleGenerate} disabled={loading} className="btn-primary inline-flex items-center gap-2 w-full">
              {loading ? <><FaSpinner className="w-4 h-4 animate-spin" /> Loading...</> : <><FaSearch className="w-4 h-4" /> Load Analytics</>}
            </button>
          </div>
        </div>
      </div>

      {error && <ErrorState message={error} onRetry={handleGenerate} />}

      {!generated && !loading && !error && (
        <EmptyState message="Select filters and click Load Analytics to view insights" icon={<FaChartBar className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-3" />} />
      )}

      {loading && <LoadingSkeleton rows={4} />}

      {generated && !loading && !error && data && (
        <>
          {(scatterData || subjectCompData || data.gradeOverTime?.length > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {scatterData && (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 uppercase tracking-wide flex items-center gap-2">
                    <FaChartLine className="w-4 h-4" />
                    Attendance vs Performance
                  </h3>
                  <LineChart data={scatterData as any} height={280} />
                </div>
              )}

              {subjectCompData && (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 uppercase tracking-wide flex items-center gap-2">
                    <FaChartBar className="w-4 h-4" />
                    Subject Comparison
                  </h3>
                  <BarChart data={subjectCompData as any} height={280} />
                </div>
              )}

              {gradeOverTimeData && (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 uppercase tracking-wide flex items-center gap-2">
                    <FaChartBar className="w-4 h-4" />
                    Grade Distribution Over Time
                  </h3>
                  <BarChart data={gradeOverTimeData as any} height={280} />
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <FaTrophy className="w-5 h-5 text-amber-500" />
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Top Performers</h3>
              </div>
              {data.topPerformers && data.topPerformers.length > 0 ? (
                <DataTable columns={topColumns} data={data.topPerformers} searchable={false} sortable={true} />
              ) : (
                <EmptyState message="No top performer data available" />
              )}
            </div>

            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <FaArrowDown className="w-5 h-5 text-red-500" />
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Bottom Performers</h3>
              </div>
              {data.bottomPerformers && data.bottomPerformers.length > 0 ? (
                <DataTable columns={bottomColumns} data={data.bottomPerformers} searchable={false} sortable={true} />
              ) : (
                <EmptyState message="No bottom performer data available" />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function Reports() {
  const [activeTab, setActiveTab] = useState<TabType>('attendance');

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">Reports</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Generate and analyze school reports</p>
      </div>

      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-6" role="tablist">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors inline-flex items-center gap-2 ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {activeTab === 'attendance' && <AttendanceTab />}
      {activeTab === 'performance' && <PerformanceTab />}
      {activeTab === 'analytics' && <AnalyticsTab />}
    </div>
  );
}
