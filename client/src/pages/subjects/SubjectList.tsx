import { useState, useEffect, useCallback } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { FaPlus, FaSearch } from 'react-icons/fa';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import SubjectForm from './SubjectForm';
import type { Subject } from '../../types';
import { useAuth } from '../../context/AuthContext';

const categoryColors: Record<string, string> = {
  core: 'badge-success',
  elective: 'badge-warning',
  optional: 'badge-info',
};

export default function SubjectList() {
  const { isHeadteacher } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editSubject, setEditSubject] = useState<Subject | null>(null);

  const fetchSubjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (categoryFilter) params.category = categoryFilter;
      const { data } = await api.get('/subjects', { params });
      setSubjects(data.data || []);
    } catch (err: any) {
      const message = err.response?.data?.message || 'Failed to load subjects';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [search, categoryFilter]);

  useEffect(() => {
    fetchSubjects();
  }, [fetchSubjects]);

  useEffect(() => {
    const timer = setTimeout(() => fetchSubjects(), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleDelete = async (subject: Subject) => {
    if (!confirm(`Are you sure you want to delete "${subject.name}"?`)) return;
    try {
      await api.delete(`/subjects/${subject._id}`);
      toast.success('Subject deleted');
      fetchSubjects();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete subject');
    }
  };

  const handleEdit = (subject: Subject) => {
    setEditSubject(subject);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditSubject(null);
  };

  const handleFormSuccess = () => {
    handleFormClose();
    fetchSubjects();
  };

  const columns = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'code', label: 'Code', sortable: true },
    {
      key: 'category',
      label: 'Category',
      sortable: true,
      render: (subject: Subject) => (
        <span className={`badge ${categoryColors[subject.category] || 'badge-info'}`}>
          {subject.category}
        </span>
      ),
    },
    {
      key: 'credits',
      label: 'Credits',
      sortable: true,
      render: (subject: Subject) => (
        <span className="font-medium text-gray-700 dark:text-gray-300">{subject.credits}</span>
      ),
    },
    {
      key: 'department',
      label: 'Department',
      sortable: true,
      render: (subject: Subject) => (
        <span className="text-gray-600 dark:text-gray-400">{subject.department || '-'}</span>
      ),
    },
    {
      key: '_id',
      label: 'Classes',
      render: () => <span className="text-gray-400">-</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">Subjects</h1>
        {isHeadteacher && (
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            <FaPlus className="w-4 h-4 mr-1.5" />
            Add Subject
          </button>
        )}
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
          className="input-field w-full sm:w-44"
          value={categoryFilter}
          onChange={(e) => {
            setCategoryFilter(e.target.value);
            fetchSubjects();
          }}
        >
          <option value="">All Categories</option>
          <option value="core">Core</option>
          <option value="elective">Elective</option>
          <option value="optional">Optional</option>
        </select>
      </div>

      {error && !loading ? (
        <div className="card p-8 text-center">
          <p className="text-red-500 dark:text-red-400 mb-2">{error}</p>
          <button className="btn-secondary" onClick={fetchSubjects}>
            Retry
          </button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={subjects}
          loading={loading}
          onEdit={isHeadteacher ? handleEdit : undefined}
          onDelete={isHeadteacher ? handleDelete : undefined}
        />
      )}

      <Modal
        isOpen={showForm}
        onClose={handleFormClose}
        title={editSubject ? 'Edit Subject' : 'Add Subject'}
        size="lg"
      >
        <SubjectForm
          subject={editSubject}
          onSuccess={handleFormSuccess}
          onCancel={handleFormClose}
        />
      </Modal>
    </div>
  );
}
