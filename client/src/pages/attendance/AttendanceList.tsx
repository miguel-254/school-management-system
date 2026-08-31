import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import StatsCard from '../../components/common/StatsCard';
import type { Attendance, AttendanceStatus, Class, Subject, Stream, ApiResponse } from '../../types';
import { FaClipboardList, FaCheckCircle, FaTimesCircle, FaDownload, FaPlus, FaFileAlt, FaEye, FaUsers } from 'react-icons/fa';

interface AttendanceRecord extends Attendance {
  studentName?: string;
  admissionNo?: string;
  className?: string;
  subjectName?: string;
}

interface Summary {
  total: number;
  present: number;
  absent: number;
  excused: number;
  sick: number;
  schoolActivity: number;
}

const statusColors: Record<AttendanceStatus, string> = {
  present: 'badge-success',
  absent: 'badge-danger',
  excused: 'badge-warning',
  sick: 'badge-info',
  schoolActivity: 'badge-primary',
};

export default function AttendanceList() {
  const navigate = useNavigate();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [streams, setStreams] = useState<Stream[]>([]);
  const [summary, setSummary] = useState<Summary>({ total: 0, present: 0, absent: 0, excused: 0, sick: 0, schoolActivity: 0 });
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [viewRecord, setViewRecord] = useState<AttendanceRecord | null>(null);

  const [filters, setFilters] = useState({
    date: new Date().toISOString().split('T')[0],
    classId: '',
    subjectId: '',
    streamId: '',
    status: '' as AttendanceStatus | '',
    page: 1,
    limit: 20,
  });

  const fetchMeta = useCallback(async () => {
    try {
      const [classesRes, subjectsRes] = await Promise.all([
        api.get<ApiResponse<Class[]>>('/classes'),
        api.get<ApiResponse<Subject[]>>('/subjects'),
      ]);
      setClasses(classesRes.data.data || []);
      setSubjects(subjectsRes.data.data || []);
    } catch {
      // non-blocking
    }
  }, []);

  useEffect(() => {
    fetchMeta();
  }, [fetchMeta]);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = { date: filters.date, page: filters.page, limit: filters.limit };
      if (filters.classId) params.class = filters.classId;
      if (filters.subjectId) params.subject = filters.subjectId;
      if (filters.streamId) params.stream = filters.streamId;
      if (filters.status) params.status = filters.status;

      const { data } = await api.get('/attendance', { params });
      const recordsData = (data.data?.records || data.data || []) as AttendanceRecord[];
      const enriched = recordsData.map((r) => ({
        ...r,
        studentName: typeof r.student === 'object' ? (r.student as any).fullName || (r.student as any).firstName + ' ' + (r.student as any).lastName : 'Unknown',
        admissionNo: typeof r.student === 'object' ? (r.student as any).admissionNumber : '',
        className: typeof r.class === 'object' ? (r.class as any).name : '',
        subjectName: typeof r.subject === 'object' ? (r.subject as any).name : '',
      }));
      setRecords(enriched);

      if (data.data?.pagination) {
        setPagination(data.data.pagination);
      }

      if (data.summary) {
        setSummary(data.summary);
      } else {
        const s: Summary = { total: enriched.length, present: 0, absent: 0, excused: 0, sick: 0, schoolActivity: 0 };
        enriched.forEach((r) => {
          if (r.status in s) (s as any)[r.status]++;
        });
        setSummary(s);
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to load attendance records';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  useEffect(() => {
    if (filters.classId) {
      const cls = classes.find((c) => c._id === filters.classId);
      if (cls && cls.streams) {
        const streamIds = cls.streams.map((s) => (typeof s === 'string' ? s : s._id));
        setStreams(cls.streams.filter((s): s is Stream => typeof s === 'object') as Stream[]);
      } else {
        setStreams([]);
      }
    } else {
      setStreams([]);
    }
  }, [filters.classId, classes]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  };

  const handlePageChange = (newPage: number) => {
    setFilters((prev) => ({ ...prev, page: newPage }));
  };

  const exportCSV = () => {
    const headers = ['Student Name', 'Admission No', 'Class', 'Subject', 'Date', 'Time', 'Status', 'Remarks'];
    const rows = records.map((r) => [
      r.studentName,
      r.admissionNo,
      r.className,
      r.subjectName,
      r.date,
      r.timeIn || '',
      r.status,
      r.remarks || '',
    ]);
    const csv = [headers.join(','), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-${filters.date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported');
  };

  const handleEdit = (record: AttendanceRecord) => {
    navigate(`/attendance/mark?edit=${record._id}`);
  };

  const presentPercent = summary.total > 0 ? ((summary.present / summary.total) * 100).toFixed(1) : '0';
  const absentPercent = summary.total > 0 ? ((summary.absent / summary.total) * 100).toFixed(1) : '0';

  const columns = [
    { key: 'studentName', label: 'Student Name', sortable: true },
    { key: 'admissionNo', label: 'Admission No', sortable: true },
    { key: 'className', label: 'Class', sortable: true },
    { key: 'subjectName', label: 'Subject', sortable: true },
    { key: 'date', label: 'Date', sortable: true },
    {
      key: 'timeIn',
      label: 'Time',
      render: (r: AttendanceRecord) => <span>{r.timeIn || '-'}</span>,
      sortable: true,
    },
    {
      key: 'status',
      label: 'Status',
      render: (r: AttendanceRecord) => (
        <span className={`badge ${statusColors[r.status]}`}>
          {r.status === 'schoolActivity' ? 'School Activity' : r.status.charAt(0).toUpperCase() + r.status.slice(1)}
        </span>
      ),
      sortable: true,
    },
    { key: 'remarks', label: 'Remarks', render: (r: AttendanceRecord) => <span className="text-gray-400">{r.remarks || '-'}</span> },
  ];

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">Attendance Records</h1>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV} className="btn-secondary">
            <FaDownload className="w-4 h-4 mr-1" />
            Export CSV
          </button>
          <button onClick={() => navigate('/attendance/mark?report=true')} className="btn-secondary">
            <FaFileAlt className="w-4 h-4 mr-1" />
            Generate Report
          </button>
          <Link to="/attendance/mark" className="btn-primary">
            <FaPlus className="w-4 h-4 mr-1" />
            Mark Attendance
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatsCard title="Total Records" value={summary.total} icon={<FaUsers className="w-5 h-5" />} color="blue" />
        <StatsCard title="Present" value={`${summary.present} (${presentPercent}%)`} icon={<FaClipboardList className="w-5 h-5" />} color="green" />
        <StatsCard title="Absent" value={`${summary.absent} (${absentPercent}%)`} icon={<FaFileAlt className="w-5 h-5" />} color="red" />
      </div>

      <div className="card">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
          <div>
            <label className="label">Date</label>
            <input
              type="date"
              className="input-field"
              value={filters.date}
              onChange={(e) => handleFilterChange('date', e.target.value)}
            />
          </div>
          <div>
            <label className="label">Class</label>
            <select className="input-field" value={filters.classId} onChange={(e) => handleFilterChange('classId', e.target.value)}>
              <option value="">All Classes</option>
              {classes.map((c) => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Subject</label>
            <select className="input-field" value={filters.subjectId} onChange={(e) => handleFilterChange('subjectId', e.target.value)}>
              <option value="">All Subjects</option>
              {subjects.map((s) => (
                <option key={s._id} value={s._id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Stream</label>
            <select className="input-field" value={filters.streamId} onChange={(e) => handleFilterChange('streamId', e.target.value)}>
              <option value="">All Streams</option>
              {streams.map((s) => (
                <option key={s._id} value={s._id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input-field" value={filters.status} onChange={(e) => handleFilterChange('status', e.target.value)}>
              <option value="">All Status</option>
              <option value="present">Present</option>
              <option value="absent">Absent</option>
              <option value="excused">Excused</option>
              <option value="sick">Sick</option>
              <option value="schoolActivity">School Activity</option>
            </select>
          </div>
        </div>

        {error && !loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="text-red-500 dark:text-red-400 mb-2">
              <FaFileAlt className="w-12 h-12 mx-auto" />
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
            <button onClick={fetchRecords} className="btn-primary">Retry</button>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={records}
            loading={loading}
            onView={(r) => setViewRecord(r)}
            onEdit={handleEdit}
          />
        )}

        {pagination.pages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Showing page {pagination.page} of {pagination.pages} ({pagination.total} total)
            </span>
            <div className="flex items-center gap-2">
              <button
                className="btn-secondary text-sm"
                disabled={pagination.page <= 1}
                onClick={() => handlePageChange(pagination.page - 1)}
              >
                Previous
              </button>
              <button
                className="btn-secondary text-sm"
                disabled={pagination.page >= pagination.pages}
                onClick={() => handlePageChange(pagination.page + 1)}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      <Modal isOpen={!!viewRecord} onClose={() => setViewRecord(null)} title="Attendance Details" size="lg">
        {viewRecord && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Student Name</label>
                <p className="text-gray-900 dark:text-white font-medium">{viewRecord.studentName}</p>
              </div>
              <div>
                <label className="label">Admission No</label>
                <p className="text-gray-900 dark:text-white">{viewRecord.admissionNo}</p>
              </div>
              <div>
                <label className="label">Class</label>
                <p className="text-gray-900 dark:text-white">{viewRecord.className}</p>
              </div>
              <div>
                <label className="label">Subject</label>
                <p className="text-gray-900 dark:text-white">{viewRecord.subjectName}</p>
              </div>
              <div>
                <label className="label">Date</label>
                <p className="text-gray-900 dark:text-white">{viewRecord.date}</p>
              </div>
              <div>
                <label className="label">Time</label>
                <p className="text-gray-900 dark:text-white">{viewRecord.timeIn || 'N/A'}</p>
              </div>
              <div>
                <label className="label">Status</label>
                <span className={`badge ${statusColors[viewRecord.status]} text-sm`}>
                  {viewRecord.status === 'schoolActivity' ? 'School Activity' : viewRecord.status.charAt(0).toUpperCase() + viewRecord.status.slice(1)}
                </span>
              </div>
              <div>
                <label className="label">Remarks</label>
                <p className="text-gray-900 dark:text-white">{viewRecord.remarks || 'No remarks'}</p>
              </div>
            </div>
            {viewRecord.deviceUsed && (
              <div>
                <label className="label">Device Used</label>
                <p className="text-gray-900 dark:text-white">{viewRecord.deviceUsed}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}