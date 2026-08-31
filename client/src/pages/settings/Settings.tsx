import { useState, useEffect, useCallback, type FormEvent } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import {
  FaSchool, FaCog, FaFileAlt, FaCalendarAlt, FaHistory, FaDatabase,
  FaSave, FaUpload, FaDownload, FaPlus, FaTrash, FaCheck,
  FaExclamationTriangle, FaRedo, FaEye, FaEdit, FaSpinner
} from 'react-icons/fa';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import type {
  SchoolSettings, AcademicYear, Term, AuditLog, GradingSystem,
  ApiResponse
} from '../../types';

const TABS = [
  { id: 'school', label: 'School Profile', icon: FaSchool },
  { id: 'academic', label: 'Academic Configuration', icon: FaCog },
  { id: 'reportcard', label: 'Report Card Configuration', icon: FaFileAlt },
  { id: 'years', label: 'Academic Years & Terms', icon: FaCalendarAlt },
  { id: 'audit', label: 'Audit Logs', icon: FaHistory },
  { id: 'backup', label: 'Backup & Restore', icon: FaDatabase },
];

const TIMEZONES = [
  'Africa/Nairobi', 'Africa/Lagos', 'Africa/Cairo', 'Africa/Johannesburg',
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'Asia/Dubai', 'Asia/Kolkata', 'Asia/Shanghai', 'Asia/Tokyo',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Moscow',
  'Pacific/Auckland', 'Australia/Sydney',
];

function formatDate(date: string | Date) {
  return new Date(date).toLocaleString();
}

function LoadingSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-4 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 rounded-lg" />
      ))}
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
        <FaExclamationTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
      </div>
      <p className="text-lg font-medium text-gray-900 dark:text-white">Failed to load</p>
      <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-md">{message}</p>
      <button onClick={onRetry} className="btn-secondary inline-flex items-center gap-2">
        <FaRedo className="w-4 h-4" /> Try Again
      </button>
    </div>
  );
}

function TabButton({ tab, active, onClick }: { tab: typeof TABS[0]; active: boolean; onClick: () => void }) {
  const Icon = tab.icon;
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all whitespace-nowrap ${
        active
          ? 'bg-blue-600 text-white shadow-md'
          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50'
      }`}
    >
      <Icon className="w-4 h-4" />
      {tab.label}
    </button>
  );
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState('school');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const renderTabContent = () => {
    switch (activeTab) {
      case 'school': return <SchoolProfileTab onLoading={setLoading} onError={setError} />;
      case 'academic': return <AcademicConfigTab onLoading={setLoading} onError={setError} />;
      case 'reportcard': return <ReportCardConfigTab />;
      case 'years': return <AcademicYearsTab onLoading={setLoading} onError={setError} />;
      case 'audit': return <AuditLogsTab onLoading={setLoading} onError={setError} />;
      case 'backup': return <BackupRestoreTab onLoading={setLoading} onError={setError} />;
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Manage school configuration and system settings</p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {TABS.map((tab) => (
          <TabButton key={tab.id} tab={tab} active={activeTab === tab.id} onClick={() => setActiveTab(tab.id)} />
        ))}
      </div>

      <div>
        {renderTabContent()}
      </div>
    </div>
  );
}

function SchoolProfileTab({ onLoading, onError }: { onLoading: (v: boolean) => void; onError: (v: string) => void }) {
  const [form, setForm] = useState({
    schoolName: '', schoolCode: '', motto: '', address: '', phone: '', email: '', website: '', principalName: '', logo: '',
  });
  const [logo, setLogo] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [fetchError, setFetchError] = useState('');

  const fetchSettings = useCallback(async () => {
    setFetching(true);
    setFetchError('');
    onLoading(true);
    onError('');
    try {
      const { data } = await api.get<ApiResponse<SchoolSettings>>('/settings/school');
      if (data.data) {
        const s = data.data;
        setForm({
          schoolName: s.schoolName || '',
          schoolCode: s.schoolCode || '',
          motto: s.motto || '',
          address: s.address || '',
          phone: s.phone || '',
          email: s.email || '',
          website: s.website || '',
          principalName: s.principalName || '',
          logo: s.logo || '',
        });
        if (s.logo) setLogo(s.logo);
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to load school settings';
      setFetchError(msg);
      onError(msg);
    } finally {
      setFetching(false);
      onLoading(false);
    }
  }, [onLoading, onError]);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setLogo(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.schoolName || !form.schoolCode) {
      toast.error('School Name and Code are required');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form };
      if (logoFile && logo) payload.logo = logo;
      const { data } = await api.put<ApiResponse<SchoolSettings>>('/settings/school', payload);
      toast.success(data.message || 'School settings saved');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (fetching) return <LoadingSkeleton rows={6} />;
  if (fetchError) return <ErrorState message={fetchError} onRetry={fetchSettings} />;

  const inputClass = "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm";

  return (
    <form onSubmit={handleSubmit} className="card p-6 space-y-6">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">School Profile</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">School Name *</label>
          <input className={inputClass} value={form.schoolName} onChange={(e) => setForm(p => ({ ...p, schoolName: e.target.value }))} required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">School Code *</label>
          <input className={inputClass} value={form.schoolCode} onChange={(e) => setForm(p => ({ ...p, schoolCode: e.target.value }))} required />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Motto</label>
          <input className={inputClass} value={form.motto} onChange={(e) => setForm(p => ({ ...p, motto: e.target.value }))} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Address</label>
          <input className={inputClass} value={form.address} onChange={(e) => setForm(p => ({ ...p, address: e.target.value }))} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone</label>
          <input className={inputClass} value={form.phone} onChange={(e) => setForm(p => ({ ...p, phone: e.target.value }))} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
          <input type="email" className={inputClass} value={form.email} onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Website</label>
          <input className={inputClass} value={form.website} onChange={(e) => setForm(p => ({ ...p, website: e.target.value }))} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Principal Name</label>
          <input className={inputClass} value={form.principalName} onChange={(e) => setForm(p => ({ ...p, principalName: e.target.value }))} />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Logo</label>
          <div className="flex items-center gap-4">
            <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 text-sm text-gray-700 dark:text-gray-300">
              <FaUpload className="w-4 h-4" />
              Upload Logo
              <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
            </label>
            {logo && (
              <img src={logo} alt="Logo preview" className="h-12 w-12 object-contain rounded border border-gray-200 dark:border-gray-600" />
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button type="submit" disabled={saving} className="btn-primary inline-flex items-center gap-2">
          {saving ? <FaSpinner className="w-4 h-4 animate-spin" /> : <FaSave className="w-4 h-4" />}
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </form>
  );
}

function AcademicConfigTab({ onLoading, onError }: { onLoading: (v: boolean) => void; onError: (v: string) => void }) {
  const [form, setForm] = useState({
    gradingSystem: 'percentage' as GradingSystem,
    terms: 3,
    semesters: 0,
    sessionTimeout: 30,
    timezone: 'Africa/Nairobi',
  });
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [fetchError, setFetchError] = useState('');

  const fetchSettings = useCallback(async () => {
    setFetching(true);
    setFetchError('');
    onLoading(true);
    onError('');
    try {
      const { data } = await api.get<ApiResponse<SchoolSettings>>('/settings/school');
      if (data.data) {
        const s = data.data;
        setForm({
          gradingSystem: s.gradingSystem || 'percentage',
          terms: s.academicYearConfig?.terms || 3,
          semesters: s.academicYearConfig?.semesters || 0,
          sessionTimeout: s.sessionTimeout || 30,
          timezone: s.timezone || 'Africa/Nairobi',
        });
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to load academic config';
      setFetchError(msg);
      onError(msg);
    } finally {
      setFetching(false);
      onLoading(false);
    }
  }, [onLoading, onError]);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        gradingSystem: form.gradingSystem,
        academicYearConfig: { terms: form.terms, semesters: form.semesters },
        sessionTimeout: form.sessionTimeout,
        timezone: form.timezone,
      };
      const { data } = await api.put<ApiResponse<SchoolSettings>>('/settings/school', payload);
      toast.success(data.message || 'Academic configuration saved');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save academic configuration');
    } finally {
      setSaving(false);
    }
  };

  if (fetching) return <LoadingSkeleton rows={4} />;
  if (fetchError) return <ErrorState message={fetchError} onRetry={fetchSettings} />;

  const inputClass = "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm";

  return (
    <form onSubmit={handleSubmit} className="card p-6 space-y-6">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Academic Configuration</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Grading System</label>
          <select className={inputClass} value={form.gradingSystem} onChange={(e) => setForm(p => ({ ...p, gradingSystem: e.target.value as GradingSystem }))}>
            <option value="percentage">Percentage</option>
            <option value="cbc">CBC</option>
            <option value="gpa">GPA</option>
            <option value="letter">Letter</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Session Timeout (minutes)</label>
          <input type="number" min={1} className={inputClass} value={form.sessionTimeout} onChange={(e) => setForm(p => ({ ...p, sessionTimeout: Number(e.target.value) }))} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Number of Terms</label>
          <input type="number" min={1} max={6} className={inputClass} value={form.terms} onChange={(e) => setForm(p => ({ ...p, terms: Number(e.target.value) }))} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Number of Semesters</label>
          <input type="number" min={0} max={4} className={inputClass} value={form.semesters} onChange={(e) => setForm(p => ({ ...p, semesters: Number(e.target.value) }))} />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Timezone</label>
          <select className={inputClass} value={form.timezone} onChange={(e) => setForm(p => ({ ...p, timezone: e.target.value }))}>
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center justify-end pt-2">
        <button type="submit" disabled={saving} className="btn-primary inline-flex items-center gap-2">
          {saving ? <FaSpinner className="w-4 h-4 animate-spin" /> : <FaSave className="w-4 h-4" />}
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </form>
  );
}

function ReportCardConfigTab() {
  const [checks, setChecks] = useState({
    showLogo: true, showPhoto: true, showQR: true, showSignature: true, showStamp: true, showGraph: false,
  });
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [fetchError, setFetchError] = useState('');

  const fetchConfig = useCallback(async () => {
    setFetching(true);
    setFetchError('');
    try {
      const { data } = await api.get<ApiResponse<SchoolSettings>>('/settings/school');
      if (data.data?.reportCardConfig) {
        setChecks({
          showLogo: data.data.reportCardConfig.showLogo ?? true,
          showPhoto: data.data.reportCardConfig.showPhoto ?? true,
          showQR: data.data.reportCardConfig.showQR ?? true,
          showSignature: data.data.reportCardConfig.showSignature ?? true,
          showStamp: data.data.reportCardConfig.showStamp ?? true,
          showGraph: data.data.reportCardConfig.showGraph ?? false,
        });
      }
    } catch (err: any) {
      setFetchError(err.response?.data?.message || err.message || 'Failed to load report card config');
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.put<ApiResponse<SchoolSettings>>('/settings/school', { reportCardConfig: checks });
      toast.success(data.message || 'Report card configuration saved');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save report card configuration');
    } finally {
      setSaving(false);
    }
  };

  if (fetching) return <LoadingSkeleton rows={3} />;
  if (fetchError) return <ErrorState message={fetchError} onRetry={fetchConfig} />;

  const checkboxes = [
    { key: 'showLogo' as const, label: 'Show Logo' },
    { key: 'showPhoto' as const, label: 'Show Photo' },
    { key: 'showQR' as const, label: 'Show QR Code' },
    { key: 'showSignature' as const, label: 'Show Signature' },
    { key: 'showStamp' as const, label: 'Show Stamp' },
    { key: 'showGraph' as const, label: 'Show Graph' },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="card p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Report Card Configuration</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">Choose which elements appear on student report cards</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {checkboxes.map(({ key, label }) => (
            <label key={key} className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
              <input
                type="checkbox"
                checked={checks[key]}
                onChange={(e) => setChecks(p => ({ ...p, [key]: e.target.checked }))}
                className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="card p-6">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Report Card Preview</h3>
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 bg-white dark:bg-gray-800/50">
          <div className="text-center border-b border-gray-300 dark:border-gray-600 pb-4 mb-4">
            {checks.showLogo && (
              <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mb-2 flex items-center justify-center text-xs text-gray-400">Logo</div>
            )}
            <h4 className="text-lg font-bold text-gray-900 dark:text-white">School Name</h4>
            <p className="text-xs text-gray-500">Report Card - Term 1 2025</p>
          </div>
          <div className="flex items-center gap-4 mb-4">
            {checks.showPhoto && (
              <div className="w-14 h-14 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center text-xs text-gray-400 shrink-0">Photo</div>
            )}
            <div className="text-sm text-gray-600 dark:text-gray-400">
              <p><strong>Student Name:</strong> John Doe</p>
              <p><strong>Class:</strong> Grade 3 East</p>
            </div>
          </div>
          <table className="w-full text-xs border-collapse mb-4">
            <thead>
              <tr className="bg-gray-100 dark:bg-gray-700">
                <th className="border border-gray-300 dark:border-gray-600 p-1.5 text-left">Subject</th>
                <th className="border border-gray-300 dark:border-gray-600 p-1.5">Score</th>
                <th className="border border-gray-300 dark:border-gray-600 p-1.5">Grade</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-300 dark:border-gray-600 p-1.5">Math</td>
                <td className="border border-gray-300 dark:border-gray-600 p-1.5 text-center">85</td>
                <td className="border border-gray-300 dark:border-gray-600 p-1.5 text-center">A</td>
              </tr>
            </tbody>
          </table>
          {checks.showGraph && (
            <div className="h-16 bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center text-xs text-gray-400 mb-3">Performance Graph</div>
          )}
          <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-700 pt-3">
            <div className="flex gap-4">
              {checks.showSignature && <div className="text-xs text-gray-400">Signature: ________</div>}
              {checks.showStamp && <div className="text-xs text-gray-400">Stamp: [__]</div>}
            </div>
            {checks.showQR && (
              <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs text-gray-400">QR</div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end">
        <button type="submit" disabled={saving} className="btn-primary inline-flex items-center gap-2">
          {saving ? <FaSpinner className="w-4 h-4 animate-spin" /> : <FaSave className="w-4 h-4" />}
          {saving ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>
    </form>
  );
}

function AcademicYearsTab({ onLoading, onError }: { onLoading: (v: boolean) => void; onError: (v: string) => void }) {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [fetching, setFetching] = useState(true);
  const [fetchError, setFetchError] = useState('');

  const [showYearModal, setShowYearModal] = useState(false);
  const [editingYear, setEditingYear] = useState<AcademicYear | null>(null);
  const [yearForm, setYearForm] = useState({ name: '', year: '', startDate: '', endDate: '' });

  const [showTermModal, setShowTermModal] = useState(false);
  const [editingTerm, setEditingTerm] = useState<Term | null>(null);
  const [selectedYearId, setSelectedYearId] = useState('');
  const [termForm, setTermForm] = useState({ name: '', startDate: '', endDate: '' });

  const [submitting, setSubmitting] = useState(false);

  const fetchYears = useCallback(async () => {
    setFetching(true);
    setFetchError('');
    onLoading(true);
    onError('');
    try {
      const { data } = await api.get<ApiResponse<AcademicYear[]>>('/academic-years');
      setYears(data.data || []);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to load academic years';
      setFetchError(msg);
      onError(msg);
    } finally {
      setFetching(false);
      onLoading(false);
    }
  }, [onLoading, onError]);

  const fetchTerms = async (yearId: string) => {
    try {
      const { data } = await api.get<ApiResponse<Term[]>>('/terms', { params: { academicYear: yearId } });
      setTerms(data.data || []);
    } catch {
      setTerms([]);
    }
  };

  useEffect(() => { fetchYears(); }, [fetchYears]);

  const openYearModal = (year?: AcademicYear) => {
    if (year) {
      setEditingYear(year);
      setYearForm({
        name: year.name,
        year: year.year,
        startDate: year.startDate?.split('T')[0] || '',
        endDate: year.endDate?.split('T')[0] || '',
      });
    } else {
      setEditingYear(null);
      setYearForm({ name: '', year: '', startDate: '', endDate: '' });
    }
    setShowYearModal(true);
  };

  const openTermModal = (yearId: string, term?: Term) => {
    setSelectedYearId(yearId);
    if (term) {
      setEditingTerm(term);
      setTermForm({
        name: term.name,
        startDate: term.startDate?.split('T')[0] || '',
        endDate: term.endDate?.split('T')[0] || '',
      });
    } else {
      setEditingTerm(null);
      setTermForm({ name: '', startDate: '', endDate: '' });
    }
    setShowTermModal(true);
  };

  const handleYearSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!yearForm.name || !yearForm.year || !yearForm.startDate || !yearForm.endDate) {
      toast.error('Fill all required fields');
      return;
    }
    setSubmitting(true);
    try {
      if (editingYear) {
        await api.put(`/academic-years/${editingYear._id}`, yearForm);
        toast.success('Academic year updated');
      } else {
        await api.post('/academic-years', yearForm);
        toast.success('Academic year created');
      }
      setShowYearModal(false);
      fetchYears();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save academic year');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTermSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!termForm.name || !termForm.startDate || !termForm.endDate) {
      toast.error('Fill all required fields');
      return;
    }
    setSubmitting(true);
    try {
      const payload = { ...termForm, academicYear: selectedYearId };
      if (editingTerm) {
        await api.put(`/terms/${editingTerm._id}`, payload);
        toast.success('Term updated');
      } else {
        await api.post('/terms', payload);
        toast.success('Term created');
      }
      setShowTermModal(false);
      fetchYears();
      fetchTerms(selectedYearId);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save term');
    } finally {
      setSubmitting(false);
    }
  };

  const setCurrentYear = async (year: AcademicYear) => {
    try {
      await api.put(`/academic-years/${year._id}`, { isCurrent: true });
      toast.success(`${year.name} set as current`);
      fetchYears();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to set current year');
    }
  };

  const deleteYear = async (year: AcademicYear) => {
    if (!confirm(`Delete ${year.name}? This cannot be undone.`)) return;
    try {
      await api.delete(`/academic-years/${year._id}`);
      toast.success('Academic year deleted');
      fetchYears();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete');
    }
  };

  const setCurrentTerm = async (term: Term) => {
    try {
      await api.put(`/terms/${term._id}`, { isCurrent: true });
      toast.success(`${term.name} set as current`);
      fetchTerms(selectedYearId);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to set current term');
    }
  };

  const deleteTerm = async (term: Term) => {
    if (!confirm(`Delete ${term.name}? This cannot be undone.`)) return;
    try {
      await api.delete(`/terms/${term._id}`);
      toast.success('Term deleted');
      fetchTerms(selectedYearId);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete');
    }
  };

  if (fetching) return <LoadingSkeleton rows={4} />;
  if (fetchError) return <ErrorState message={fetchError} onRetry={fetchYears} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Academic Years</h2>
        <button onClick={() => openYearModal()} className="btn-primary inline-flex items-center gap-2">
          <FaPlus className="w-4 h-4" /> Add Year
        </button>
      </div>

      {years.length === 0 ? (
        <div className="card p-12 text-center text-gray-500 dark:text-gray-400">
          No academic years defined. Click "Add Year" to create one.
        </div>
      ) : (
        <div className="space-y-4">
          {years.map((year) => (
            <div key={year._id} className={`card p-5 ${year.isCurrent ? 'ring-2 ring-blue-500' : ''}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold text-gray-900 dark:text-white">{year.name}</h3>
                  {year.isCurrent && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 rounded-full">Current</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {!year.isCurrent && (
                    <button onClick={() => setCurrentYear(year)} className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors" title="Set as current">
                      <FaCheck className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={() => openYearModal(year)} className="p-1.5 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors" title="Edit">
                    <FaEdit className="w-4 h-4" />
                  </button>
                  <button onClick={() => deleteYear(year)} className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="Delete">
                    <FaTrash className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                {new Date(year.startDate).toLocaleDateString()} - {new Date(year.endDate).toLocaleDateString()}
              </p>

              <div className="border-t border-gray-200 dark:border-gray-700 pt-3 mt-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Terms</span>
                  <button onClick={() => { setSelectedYearId(year._id); setTerms([]); openTermModal(year._id); }} className="text-xs text-blue-600 hover:text-blue-700 inline-flex items-center gap-1">
                    <FaPlus className="w-3 h-3" /> Add Term
                  </button>
                </div>
                {year.terms && year.terms.length > 0 ? (
                  <div className="space-y-1">
                    {(year.terms as any[]).map((t) => {
                      const termId = typeof t === 'object' ? t._id : t;
                      return (
                        <div key={termId} className="flex items-center justify-between py-1.5 px-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg text-sm">
                          <span className="text-gray-700 dark:text-gray-300">{typeof t === 'object' ? t.name : termId}</span>
                          <div className="flex items-center gap-1">
                            {typeof t === 'object' && !t.isCurrent && (
                              <button onClick={() => setCurrentTerm(t as Term)} className="p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded" title="Set current">
                                <FaCheck className="w-3 h-3" />
                              </button>
                            )}
                            {typeof t === 'object' && (
                              <>
                                <button onClick={() => openTermModal(year._id, t as Term)} className="p-1 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded" title="Edit">
                                  <FaEdit className="w-3 h-3" />
                                </button>
                                <button onClick={() => deleteTerm(t as Term)} className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded" title="Delete">
                                  <FaTrash className="w-3 h-3" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">No terms defined</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={showYearModal} onClose={() => setShowYearModal(false)} title={editingYear ? 'Edit Academic Year' : 'Create Academic Year'}>
        <form onSubmit={handleYearSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
            <input className="input-field" value={yearForm.name} onChange={(e) => setYearForm(p => ({ ...p, name: e.target.value }))} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Year *</label>
            <input className="input-field" value={yearForm.year} onChange={(e) => setYearForm(p => ({ ...p, year: e.target.value }))} placeholder="e.g. 2025-2026" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date *</label>
            <input type="date" className="input-field" value={yearForm.startDate} onChange={(e) => setYearForm(p => ({ ...p, startDate: e.target.value }))} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date *</label>
            <input type="date" className="input-field" value={yearForm.endDate} onChange={(e) => setYearForm(p => ({ ...p, endDate: e.target.value }))} required />
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setShowYearModal(false)}>Cancel</button>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? 'Saving...' : editingYear ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showTermModal} onClose={() => setShowTermModal(false)} title={editingTerm ? 'Edit Term' : 'Create Term'}>
        <form onSubmit={handleTermSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
            <input className="input-field" value={termForm.name} onChange={(e) => setTermForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Term 1" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date *</label>
            <input type="date" className="input-field" value={termForm.startDate} onChange={(e) => setTermForm(p => ({ ...p, startDate: e.target.value }))} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date *</label>
            <input type="date" className="input-field" value={termForm.endDate} onChange={(e) => setTermForm(p => ({ ...p, endDate: e.target.value }))} required />
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setShowTermModal(false)}>Cancel</button>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? 'Saving...' : editingTerm ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function AuditLogsTab({ onLoading, onError }: { onLoading: (v: boolean) => void; onError: (v: string) => void }) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [fetching, setFetching] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({ user: '', action: '', startDate: '', endDate: '' });
  const limit = 20;

  const fetchLogs = useCallback(async (p: number) => {
    setFetching(true);
    setFetchError('');
    onLoading(true);
    onError('');
    try {
      const params: any = { page: p, limit };
      if (filters.user) params.user = filters.user;
      if (filters.action) params.action = filters.action;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      const { data } = await api.get<ApiResponse<AuditLog[]>>('/settings/audit-logs', { params });
      setLogs(data.data || []);
      if (data.pagination) {
        setTotalPages(data.pagination.pages);
        setTotal(data.pagination.total);
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to load audit logs';
      setFetchError(msg);
      onError(msg);
    } finally {
      setFetching(false);
      onLoading(false);
    }
  }, [filters, onLoading, onError]);

  useEffect(() => { fetchLogs(page); }, [page, fetchLogs]);

  useEffect(() => { setPage(1); }, [filters]);

  const handleExport = async () => {
    try {
      const params: any = { export: 'csv' };
      if (filters.user) params.user = filters.user;
      if (filters.action) params.action = filters.action;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      const { data } = await api.get('/settings/audit-logs/export', { params, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Audit logs exported');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to export');
    }
  };

  const columns = [
    { key: 'user', label: 'User', render: (item: AuditLog) => {
      const userName = typeof item.user === 'object' && item.user ? (item.user as any).fullName || (item.user as any).email || 'Unknown' : item.user || 'System';
      return <span className="text-sm">{userName}</span>;
    }},
    { key: 'action', label: 'Action' },
    { key: 'resource', label: 'Resource' },
    { key: 'details', label: 'Details', render: (item: AuditLog) => (
      <span className="text-sm text-gray-500 dark:text-gray-400 max-w-[200px] truncate block">{item.details ? JSON.stringify(item.details).slice(0, 60) : '-'}</span>
    )},
    { key: 'ipAddress', label: 'IP Address' },
    { key: 'timestamp', label: 'Timestamp', render: (item: AuditLog) => (
      <span className="text-sm">{formatDate(item.timestamp)}</span>
    )},
  ];

  const inputClass = "w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none";

  if (fetchError && logs.length === 0) return <ErrorState message={fetchError} onRetry={() => fetchLogs(page)} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Audit Logs {total > 0 && <span className="text-sm font-normal text-gray-500">({total} entries)</span>}</h2>
        <button onClick={handleExport} className="btn-secondary inline-flex items-center gap-2">
          <FaDownload className="w-4 h-4" /> Export
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-2 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">User</label>
          <input className={inputClass} value={filters.user} onChange={(e) => setFilters(p => ({ ...p, user: e.target.value }))} placeholder="Filter by user" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Action</label>
          <input className={inputClass} value={filters.action} onChange={(e) => setFilters(p => ({ ...p, action: e.target.value }))} placeholder="Filter by action" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Start Date</label>
          <input type="date" className={inputClass} value={filters.startDate} onChange={(e) => setFilters(p => ({ ...p, startDate: e.target.value }))} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">End Date</label>
          <input type="date" className={inputClass} value={filters.endDate} onChange={(e) => setFilters(p => ({ ...p, endDate: e.target.value }))} />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={logs}
        loading={fetching}
        searchable={false}
        sortable={false}
      />

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2">
          <span className="text-sm text-gray-500 dark:text-gray-400">Page {page} of {totalPages}</span>
          <div className="flex items-center gap-2">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="btn-secondary text-sm px-3 py-1">Previous</button>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="btn-secondary text-sm px-3 py-1">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}

function BackupRestoreTab({ onLoading, onError }: { onLoading: (v: boolean) => void; onError: (v: string) => void }) {
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [fetching, setFetching] = useState(true);
  const [fetchError, setFetchError] = useState('');

  const fetchBackupInfo = useCallback(async () => {
    setFetching(true);
    setFetchError('');
    onLoading(true);
    onError('');
    try {
      const { data } = await api.get<ApiResponse<{ lastBackup: string }>>('/settings/backup/info');
      if (data.data?.lastBackup) setLastBackup(data.data.lastBackup);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to load backup info';
      setFetchError(msg);
      onError(msg);
    } finally {
      setFetching(false);
      onLoading(false);
    }
  }, [onLoading, onError]);

  useEffect(() => { fetchBackupInfo(); }, [fetchBackupInfo]);

  const handleBackup = async () => {
    if (!confirm('Create a database backup? This may take a moment.')) return;
    setBackingUp(true);
    try {
      const { data } = await api.get('/settings/backup/export', { responseType: 'blob' });
      const blob = new Blob([data]);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Backup downloaded');
      setLastBackup(new Date().toISOString());
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Backup failed');
    } finally {
      setBackingUp(false);
    }
  };

  const handleRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/json') {
      setRestoreFile(file);
    } else {
      toast.error('Please select a valid JSON file');
    }
  };

  const handleRestore = async () => {
    if (!restoreFile) return;
    setRestoring(true);
    try {
      const formData = new FormData();
      formData.append('backup', restoreFile);
      const { data } = await api.post<ApiResponse>('/settings/backup/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(data.message || 'Database restored successfully');
      setShowRestoreConfirm(false);
      setRestoreFile(null);
      fetchBackupInfo();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Restore failed');
    } finally {
      setRestoring(false);
    }
  };

  if (fetching) return <LoadingSkeleton rows={3} />;
  if (fetchError) return <ErrorState message={fetchError} onRetry={fetchBackupInfo} />;

  return (
    <div className="space-y-6">
      <div className="card p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Database Backup</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {lastBackup ? `Last backup: ${formatDate(lastBackup)}` : 'No backups yet'}
        </p>
        <button onClick={handleBackup} disabled={backingUp} className="btn-primary inline-flex items-center gap-2">
          {backingUp ? <FaSpinner className="w-4 h-4 animate-spin" /> : <FaDownload className="w-4 h-4" />}
          {backingUp ? 'Backing up...' : 'Download Backup'}
        </button>
      </div>

      <div className="card p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Database Restore</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">Upload a previously downloaded backup JSON file to restore the database.</p>
        <div className="flex items-center gap-4">
          <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 text-sm text-gray-700 dark:text-gray-300">
            <FaUpload className="w-4 h-4" /> Choose Backup File
            <input type="file" accept=".json,application/json" className="hidden" onChange={handleRestoreFile} />
          </label>
          {restoreFile && <span className="text-sm text-gray-600 dark:text-gray-400">{restoreFile.name}</span>}
        </div>
        {restoreFile && (
          <div className="pt-2">
            <button onClick={() => setShowRestoreConfirm(true)} className="btn-primary inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700">
              <FaUpload className="w-4 h-4" /> Restore Database
            </button>
          </div>
        )}
      </div>

      <Modal isOpen={showRestoreConfirm} onClose={() => setShowRestoreConfirm(false)} title="Confirm Database Restore" size="sm">
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <FaExclamationTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
            <p className="text-sm text-red-700 dark:text-red-300">This will replace all existing data. This action cannot be undone.</p>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Restore from: <strong>{restoreFile?.name}</strong></p>
          <div className="flex items-center justify-end gap-2">
            <button className="btn-secondary" onClick={() => setShowRestoreConfirm(false)}>Cancel</button>
            <button onClick={handleRestore} disabled={restoring} className="btn-primary bg-red-600 hover:bg-red-700">
              {restoring ? 'Restoring...' : 'Confirm Restore'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}