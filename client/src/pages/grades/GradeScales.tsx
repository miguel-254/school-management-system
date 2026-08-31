import { useState, useEffect, useCallback } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import DataTable from '../../components/common/DataTable';
import GradeScalesForm from './GradeScalesForm';
import type { GradeScale, ApiResponse } from '../../types';
import { FaPlus, FaTimesCircle } from 'react-icons/fa';

export default function GradeScales() {
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
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">Grade Scales</h1>
      </div>

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
    </div>
  );
}
