import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { FaPlus, FaSearch } from 'react-icons/fa';
import DataTable from '../../components/common/DataTable';
import type { Class, AcademicYear } from '../../types';

export default function ClassList() {
  const navigate = useNavigate();
  const [classes, setClasses] = useState<Class[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [yearFilter, setYearFilter] = useState('');

  const fetchClasses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (yearFilter) params.academicYear = yearFilter;
      const { data } = await api.get('/classes', { params });
      setClasses(data.data || []);
    } catch (err: any) {
      const message = err.response?.data?.message || 'Failed to load classes';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [search, yearFilter]);

  useEffect(() => {
    const fetchYears = async () => {
      try {
        const { data } = await api.get('/academic-years', { params: { limit: 50 } });
        setAcademicYears(data.data || []);
      } catch {
        // non-critical
      }
    };
    fetchYears();
  }, []);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  useEffect(() => {
    const timer = setTimeout(() => fetchClasses(), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleDelete = async (cls: Class) => {
    if (!confirm(`Are you sure you want to delete "${cls.name}"?`)) return;
    try {
      await api.delete(`/classes/${cls._id}`);
      toast.success('Class deleted');
      fetchClasses();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete class');
    }
  };

  const getTeacherName = (cls: Class): string => {
    if (!cls.classTeacher) return 'Not assigned';
    if (typeof cls.classTeacher === 'object') return (cls.classTeacher as any).fullName || (cls.classTeacher as any).firstName + ' ' + (cls.classTeacher as any).lastName;
    return 'Assigned';
  };

  const getAcademicYearName = (cls: Class): string => {
    if (!cls.academicYear) return '-';
    if (typeof cls.academicYear === 'object') return (cls.academicYear as AcademicYear).name;
    return cls.academicYear;
  };

  const columns = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'code', label: 'Code', sortable: true },
    {
      key: 'classTeacher',
      label: 'Class Teacher',
      render: (cls: Class) => (
        <span className="text-gray-700 dark:text-gray-300">{getTeacherName(cls)}</span>
      ),
    },
    {
      key: 'streams',
      label: 'Streams',
      render: (cls: Class) => (
        <span className="badge badge-info">{cls.streams?.length || 0}</span>
      ),
    },
    {
      key: '_id',
      label: 'Students',
      render: () => <span className="text-gray-500">-</span>,
    },
    {
      key: 'subjects',
      label: 'Subjects',
      render: (cls: Class) => (
        <span className="badge badge-primary">{cls.subjects?.length || 0}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">Classes</h1>
        <Link to="/classes/new" className="btn-primary">
          <FaPlus className="w-4 h-4 mr-1.5" />
          Add Class
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or code..."
            className="input-field pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input-field w-full sm:w-56"
          value={yearFilter}
          onChange={(e) => {
            setYearFilter(e.target.value);
            fetchClasses();
          }}
        >
          <option value="">All Academic Years</option>
          {academicYears.map((y) => (
            <option key={y._id} value={y._id}>
              {y.name} ({y.year}){y.isCurrent ? ' (Current)' : ''}
            </option>
          ))}
        </select>
      </div>

      {error && !loading ? (
        <div className="card p-8 text-center">
          <p className="text-red-500 dark:text-red-400 mb-2">{error}</p>
          <button className="btn-secondary" onClick={fetchClasses}>
            Retry
          </button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={classes}
          loading={loading}
          onView={(cls) => navigate(`/classes/${cls._id}`)}
          onEdit={(cls) => navigate(`/classes/${cls._id}/edit`)}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
