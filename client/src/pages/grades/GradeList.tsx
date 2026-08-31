import { useState, useEffect, useCallback } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import DataTable from '../../components/common/DataTable';
import { PieChart, DoughnutChart } from '../../components/charts/Charts';
import GradeScalesForm from './GradeScalesForm';
import type { GradeScale, Class, Subject, Term, Stream, ApiResponse } from '../../types';
import {
  FaPlus, FaCalculator, FaChartPie, FaFileExport, FaTimesCircle, FaDownload, FaUserGraduate,
} from 'react-icons/fa';

type Tab = 'scales' | 'calculate' | 'results';

interface CalculatedGrade {
  studentId: string;
  name: string;
  admissionNumber: string;
  score: number;
  grade: string;
  gradePoint: number;
}

interface GradeDistribution {
  grade: string;
  count: number;
  color: string;
}

const gradeColors: Record<string, string> = {
  A: '#22c55e',
  'A-': '#4ade80',
  'B+': '#86efac',
  B: '#facc15',
  'B-': '#fde047',
  'C+': '#fb923c',
  C: '#f97316',
  'C-': '#fdba74',
  D: '#ef4444',
  E: '#dc2626',
  F: '#b91c1c',
  EE: '#22c55e',
  ME: '#facc15',
  AE: '#fb923c',
  BE: '#ef4444',
};



export default function GradeList() {
  const [activeTab, setActiveTab] = useState<Tab>('scales');

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">Grades</h1>
      </div>

      <div className="border-b border-gray-200 dark:border-gray-700">
        <div className="flex gap-1">
          {defaultTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-primary-600 text-primary-700 dark:text-primary-300 dark:border-primary-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === 'scales' && <GradeScalesTab />}
      {activeTab === 'calculate' && <CalculateGradesTab />}
      {activeTab === 'results' && <GradeReportTab />}
    </div>
  );
}

function GradeScalesTab() {
  const [scales, setScales] = useState<GradeScale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editScale, setEditScale] = useState<GradeScale | null>(null);

  const fetchScales = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<ApiResponse<GradeScale[]>>('/grade-scales');
      setScales(data.data || []);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to load grade scales';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchScales(); }, [fetchScales]);

  const handleEdit = (scale: GradeScale) => {
    setEditScale(scale);
    setShowForm(true);
  };

  const handleDelete = async (scale: GradeScale) => {
    if (!confirm(`Delete grade scale "${scale.name}"?`)) return;
    try {
      await api.delete(`/grade-scales/${scale._id}`);
      toast.success('Grade scale deleted');
      fetchScales();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete');
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditScale(null);
  };

  const handleFormSuccess = () => {
    handleFormClose();
    fetchScales();
  };

  const columns = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'code', label: 'Code', sortable: true },
    { key: 'minScore', label: 'Min Score', sortable: true },
    { key: 'maxScore', label: 'Max Score', sortable: true },
    { key: 'gradePoint', label: 'Grade Point', sortable: true },
    { key: 'remark', label: 'Remark', sortable: true },
    { key: 'system', label: 'System', sortable: true, render: (s: GradeScale) => <span className="capitalize">{s.system}</span> },
    {
      key: 'isActive',
      label: 'Status',
      render: (s: GradeScale) => s.isActive ? (
        <span className="badge badge-success">Active</span>
      ) : (
        <span className="badge badge-danger">Inactive</span>
      ),
      sortable: true,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">{scales.length} grade scale(s)</p>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          <FaPlus className="w-4 h-4 mr-1" />
          Add Grade Scale
        </button>
      </div>

      {error && !loading ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <FaTimesCircle className="w-12 h-12 text-red-500 dark:text-red-400 mx-auto mb-2" />
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
          <button onClick={fetchScales} className="btn-primary">Retry</button>
        </div>
      ) : (
        <DataTable
          columns={columns as any}
          data={scales}
          loading={loading}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}

      <GradeScalesForm
        isOpen={showForm}
        onClose={handleFormClose}
        onSuccess={handleFormSuccess}
        gradeScale={editScale}
        existingScales={scales}
      />
    </div>
  );
}

function CalculateGradesTab() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [streams, setStreams] = useState<Stream[]>([]);
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [results, setResults] = useState<CalculatedGrade[] | null>(null);
  const [distribution, setDistribution] = useState<GradeDistribution[]>([]);

  const [form, setForm] = useState({
    classId: '',
    subjectId: '',
    termId: '',
    streamId: '',
  });

  const fetchMeta = useCallback(async () => {
    try {
      const [classesRes, subjectsRes, termsRes] = await Promise.all([
        api.get<ApiResponse<Class[]>>('/classes'),
        api.get<ApiResponse<Subject[]>>('/subjects'),
        api.get<ApiResponse<Term[]>>('/terms'),
      ]);
      setClasses(classesRes.data.data || []);
      setSubjects(subjectsRes.data.data || []);
      setTerms(termsRes.data.data || []);
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

  const handleCalculate = async () => {
    if (!form.classId || !form.subjectId || !form.termId) {
      toast.error('Please select class, subject, and term');
      return;
    }
    setCalculating(true);
    try {
      const body: Record<string, string> = {
        class: form.classId,
        subject: form.subjectId,
        term: form.termId,
      };
      if (form.streamId) body.stream = form.streamId;

      const { data } = await api.post('/grades/calculate', body);
      const gradeResults = (data.data || []) as CalculatedGrade[];
      setResults(gradeResults);

      const distMap: Record<string, number> = {};
      gradeResults.forEach((r) => {
        const g = r.grade || 'Ungraded';
        distMap[g] = (distMap[g] || 0) + 1;
      });
      const distArray = Object.entries(distMap).map(([grade, count]) => ({
        grade,
        count,
        color: gradeColors[grade] || '#6b7280',
      }));
      setDistribution(distArray);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to calculate grades');
    } finally {
      setCalculating(false);
    }
  };

  const resultColumns = [
    {
      key: 'name',
      label: 'Student Name',
      render: (r: CalculatedGrade) => (
        <span className="font-medium text-gray-900 dark:text-white">{r.name}</span>
      ),
    },
    { key: 'admissionNumber', label: 'Admission No' },
    {
      key: 'score',
      label: 'Score',
      render: (r: CalculatedGrade) => (
        <span className="font-semibold">{r.score}</span>
      ),
      sortable: true,
    },
    {
      key: 'grade',
      label: 'Grade',
      render: (r: CalculatedGrade) => (
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-sm font-bold">
          {r.grade}
        </span>
      ),
      sortable: true,
    },
    {
      key: 'gradePoint',
      label: 'Grade Point',
      render: (r: CalculatedGrade) => <span>{r.gradePoint?.toFixed(1) || '-'}</span>,
      sortable: true,
    },
  ];

  const chartData = distribution.length > 0 ? {
    labels: distribution.map((d) => d.grade),
    datasets: [{
      label: 'Students',
      data: distribution.map((d) => d.count),
      backgroundColor: distribution.map((d) => d.color),
      borderWidth: 2,
      borderColor: '#ffffff',
    }],
  } : null;

  return (
    <div className="space-y-4">
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Calculate Grades</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="label">Class *</label>
            <select className="input-field" value={form.classId} onChange={(e) => setForm((p) => ({ ...p, classId: e.target.value, streamId: '' }))}>
              <option value="">Select Class</option>
              {classes.map((c) => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Stream</label>
            <select className="input-field" value={form.streamId} onChange={(e) => setForm((p) => ({ ...p, streamId: e.target.value }))}>
              <option value="">All Streams</option>
              {streams.map((s) => (
                <option key={s._id} value={s._id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Subject *</label>
            <select className="input-field" value={form.subjectId} onChange={(e) => setForm((p) => ({ ...p, subjectId: e.target.value }))}>
              <option value="">Select Subject</option>
              {subjects.map((s) => (
                <option key={s._id} value={s._id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Term *</label>
            <select className="input-field" value={form.termId} onChange={(e) => setForm((p) => ({ ...p, termId: e.target.value }))}>
              <option value="">Select Term</option>
              {terms.map((t) => (
                <option key={t._id} value={t._id}>{t.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex justify-end mt-4">
          <button className="btn-primary" disabled={calculating} onClick={handleCalculate}>
            {calculating ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-1" />
                Calculating...
              </>
            ) : (
              <>
                <FaCalculator className="w-4 h-4 mr-1" />
                Calculate
              </>
            )}
          </button>
        </div>
      </div>

      {results !== null && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Results ({results.length} students)
              </h3>
              {results.length === 0 ? (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <FaUserGraduate className="w-12 h-12 mx-auto mb-2" />
                  <p>No results found</p>
                </div>
              ) : (
                <DataTable
                  columns={resultColumns as any}
                  data={results as any}
                  searchable={false}
                  sortable={true}
                />
              )}
            </div>
          </div>
          <div>
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Grade Distribution</h3>
              {distribution.length > 0 && chartData ? (
                <DoughnutChart data={chartData as any} height={260} />
              ) : (
                <div className="flex items-center justify-center h-[260px] text-gray-400 dark:text-gray-500 text-sm">
                  No distribution data
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GradeReportTab() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [streams, setStreams] = useState<Stream[]>([]);
  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState<any[] | null>(null);
  const [distribution, setDistribution] = useState<GradeDistribution[]>([]);

  const [form, setForm] = useState({
    classId: '',
    subjectId: '',
    termId: '',
    streamId: '',
  });

  const fetchMeta = useCallback(async () => {
    try {
      const [classesRes, subjectsRes, termsRes] = await Promise.all([
        api.get<ApiResponse<Class[]>>('/classes'),
        api.get<ApiResponse<Subject[]>>('/subjects'),
        api.get<ApiResponse<Term[]>>('/terms'),
      ]);
      setClasses(classesRes.data.data || []);
      setSubjects(subjectsRes.data.data || []);
      setTerms(termsRes.data.data || []);
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

  const fetchReport = async () => {
    if (!form.classId || !form.subjectId || !form.termId) {
      toast.error('Please select class, subject, and term');
      return;
    }
    setLoading(true);
    try {
      const params: Record<string, string> = {
        class: form.classId,
        subject: form.subjectId,
        term: form.termId,
      };
      if (form.streamId) params.stream = form.streamId;

      const { data } = await api.get('/grades/report', { params });
      const reportData = (data.data || []) as any[];
      const sorted = [...reportData].sort((a, b) => (b.score || 0) - (a.score || 0));
      const withPosition = sorted.map((r, i) => ({ ...r, position: i + 1 }));
      setReports(withPosition);

      const distMap: Record<string, number> = {};
      withPosition.forEach((r) => {
        const g = r.grade || 'Ungraded';
        distMap[g] = (distMap[g] || 0) + 1;
      });
      const distArray = Object.entries(distMap).map(([grade, count]) => ({
        grade,
        count,
        color: gradeColors[grade] || '#6b7280',
      }));
      setDistribution(distArray);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load grade report');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (!reports || reports.length === 0) {
      toast.error('No data to export');
      return;
    }
    const headers = ['Student Name', 'Admission No', 'Score', 'Grade', 'Grade Point', 'Position'];
    const csvRows = [headers.join(',')];
    reports.forEach((r: any) => {
      csvRows.push([
        `"${r.name || r.studentName || ''}"`,
        `"${r.admissionNumber || ''}"`,
        r.score ?? '',
        r.grade || '',
        r.gradePoint ?? '',
        r.position ?? '',
      ].join(','));
    });
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `grade-report-${form.classId}-${form.subjectId}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Report exported');
  };

  const reportColumns = [
    {
      key: 'name',
      label: 'Student Name',
      render: (r: any) => (
        <span className="font-medium text-gray-900 dark:text-white">{r.name || r.studentName || r.fullName || '-'}</span>
      ),
      sortable: true,
    },
    {
      key: 'admissionNumber',
      label: 'Admission No',
      render: (r: any) => <span className="text-gray-600 dark:text-gray-400">{r.admissionNumber || ''}</span>,
    },
    {
      key: 'score',
      label: 'Score',
      render: (r: any) => <span className="font-semibold">{r.score ?? '-'}</span>,
      sortable: true,
    },
    {
      key: 'grade',
      label: 'Grade',
      render: (r: any) => r.grade ? (
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-sm font-bold">
          {r.grade}
        </span>
      ) : <span className="text-gray-400">-</span>,
      sortable: true,
    },
    {
      key: 'gradePoint',
      label: 'Grade Point',
      render: (r: any) => <span>{r.gradePoint?.toFixed(1) || '-'}</span>,
      sortable: true,
    },
    {
      key: 'position',
      label: 'Position',
      render: (r: any) => (
        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
          r.position === 1
            ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
            : r.position === 2
            ? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
            : r.position === 3
            ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
            : 'text-gray-600 dark:text-gray-400'
        }`}>
          {r.position}
        </span>
      ),
      sortable: true,
    },
  ];

  const chartData = distribution.length > 0 ? {
    labels: distribution.map((d) => d.grade),
    datasets: [{
      label: 'Students',
      data: distribution.map((d) => d.count),
      backgroundColor: distribution.map((d) => d.color),
      borderWidth: 2,
      borderColor: '#ffffff',
    }],
  } : null;

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="label">Class *</label>
            <select className="input-field" value={form.classId} onChange={(e) => setForm((p) => ({ ...p, classId: e.target.value, streamId: '' }))}>
              <option value="">Select Class</option>
              {classes.map((c) => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Stream</label>
            <select className="input-field" value={form.streamId} onChange={(e) => setForm((p) => ({ ...p, streamId: e.target.value }))}>
              <option value="">All Streams</option>
              {streams.map((s) => (
                <option key={s._id} value={s._id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Subject *</label>
            <select className="input-field" value={form.subjectId} onChange={(e) => setForm((p) => ({ ...p, subjectId: e.target.value }))}>
              <option value="">Select Subject</option>
              {subjects.map((s) => (
                <option key={s._id} value={s._id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Term *</label>
            <select className="input-field" value={form.termId} onChange={(e) => setForm((p) => ({ ...p, termId: e.target.value }))}>
              <option value="">Select Term</option>
              {terms.map((t) => (
                <option key={t._id} value={t._id}>{t.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex justify-end mt-4">
          <button className="btn-primary" disabled={loading} onClick={fetchReport}>
            {loading ? 'Loading...' : 'Generate Report'}
          </button>
        </div>
      </div>

      {reports !== null && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Grade Report ({reports.length} students)
                  </h3>
                  <button className="btn-secondary text-sm" onClick={handleExport}>
                    <FaDownload className="w-4 h-4 mr-1" />
                    Export CSV
                  </button>
                </div>
                {loading ? (
                  <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary-600" />
                  </div>
                ) : reports.length === 0 ? (
                  <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                    <FaUserGraduate className="w-12 h-12 mx-auto mb-2" />
                    <p>No data available</p>
                  </div>
                ) : (
                  <DataTable
                    columns={reportColumns as any}
                    data={reports}
                    searchable={true}
                  />
                )}
              </div>
            </div>
            <div>
              <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Grade Distribution</h3>
                {distribution.length > 0 && chartData ? (
                  <PieChart data={chartData as any} height={260} />
                ) : (
                  <div className="flex items-center justify-center h-[260px] text-gray-400 dark:text-gray-500 text-sm">
                    No distribution data
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const defaultTabs = [
  { key: 'scales' as Tab, label: 'Grade Scales', icon: FaChartPie },
  { key: 'calculate' as Tab, label: 'Calculate Grades', icon: FaCalculator },
  { key: 'results' as Tab, label: 'Grade Report', icon: FaFileExport },
];

