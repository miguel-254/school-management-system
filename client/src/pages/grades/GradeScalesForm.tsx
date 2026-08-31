import { useState, useEffect } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import Modal from '../../components/common/Modal';
import type { GradeScale, GradingSystem, ApiResponse } from '../../types';

interface GradeScalesFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  gradeScale?: GradeScale | null;
  existingScales?: GradeScale[];
}

const systemOptions: { value: GradingSystem; label: string }[] = [
  { value: 'percentage', label: 'Percentage' },
  { value: 'cbc', label: 'CBC' },
  { value: 'gpa', label: 'GPA' },
  { value: 'letter', label: 'Letter' },
];

export default function GradeScalesForm({ isOpen, onClose, onSuccess, gradeScale, existingScales = [] }: GradeScalesFormProps) {
  const [form, setForm] = useState({
    name: '',
    code: '',
    minScore: '',
    maxScore: '',
    gradePoint: '',
    description: '',
    remark: '',
    system: 'percentage' as GradingSystem,
    isActive: true,
  });
  const [saving, setSaving] = useState(false);
  const [rangeWarning, setRangeWarning] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isEditing = !!gradeScale;

  useEffect(() => {
    if (gradeScale) {
      setForm({
        name: gradeScale.name,
        code: gradeScale.code,
        minScore: String(gradeScale.minScore),
        maxScore: String(gradeScale.maxScore),
        gradePoint: String(gradeScale.gradePoint),
        description: gradeScale.description || '',
        remark: gradeScale.remark || '',
        system: gradeScale.system,
        isActive: gradeScale.isActive,
      });
    } else {
      setForm({
        name: '',
        code: '',
        minScore: '',
        maxScore: '',
        gradePoint: '',
        description: '',
        remark: '',
        system: 'percentage' as GradingSystem,
        isActive: true,
      });
    }
    setErrors({});
    setRangeWarning(null);
  }, [gradeScale, isOpen]);

  useEffect(() => {
    const min = parseFloat(form.minScore);
    const max = parseFloat(form.maxScore);
    if (!isNaN(min) && !isNaN(max) && min <= max) {
      const overlap = existingScales.find((s) => {
        if (isEditing && s._id === gradeScale._id) return false;
        return !(max < s.minScore || min > s.maxScore);
      });
      if (overlap) {
        setRangeWarning(`Overlaps with "${overlap.name}" (${overlap.minScore}-${overlap.maxScore})`);
      } else {
        setRangeWarning(null);
      }
    } else {
      setRangeWarning(null);
    }
  }, [form.minScore, form.maxScore, existingScales, gradeScale, isEditing]);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    if (!form.code.trim()) errs.code = 'Code is required';
    if (!form.minScore.trim() || isNaN(parseFloat(form.minScore))) errs.minScore = 'Valid min score is required';
    if (!form.maxScore.trim() || isNaN(parseFloat(form.maxScore))) errs.maxScore = 'Valid max score is required';
    const min = parseFloat(form.minScore);
    const max = parseFloat(form.maxScore);
    if (!isNaN(min) && !isNaN(max) && min > max) errs.maxScore = 'Max score must be >= min score';
    if (!form.gradePoint.trim() || isNaN(parseFloat(form.gradePoint))) {
      const pt = parseFloat(form.gradePoint);
      if (pt < 0) errs.gradePoint = 'Grade point cannot be negative';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleChange = (field: string, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim(),
        minScore: parseFloat(form.minScore),
        maxScore: parseFloat(form.maxScore),
        gradePoint: parseFloat(form.gradePoint) || 0,
        description: form.description.trim(),
        remark: form.remark.trim(),
        system: form.system,
        isActive: form.isActive,
      };

      if (isEditing) {
        await api.put(`/grade-scales/${gradeScale._id}`, payload);
        toast.success('Grade scale updated');
      } else {
        await api.post('/grade-scales', payload);
        toast.success('Grade scale created');
      }
      onSuccess();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save grade scale');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? 'Edit Grade Scale' : 'Add Grade Scale'} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Name *</label>
            <input
              type="text"
              className={`input-field ${errors.name ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
              placeholder="e.g. A, B, C"
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
              autoFocus
            />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
          </div>
          <div>
            <label className="label">Code *</label>
            <input
              type="text"
              className={`input-field ${errors.code ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
              placeholder="e.g. A, B+, B"
              value={form.code}
              onChange={(e) => handleChange('code', e.target.value)}
            />
            {errors.code && <p className="text-red-500 text-xs mt-1">{errors.code}</p>}
          </div>
          <div>
            <label className="label">Min Score *</label>
            <input
              type="number"
              className={`input-field ${errors.minScore ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
              placeholder="0"
              min={0}
              step={0.5}
              value={form.minScore}
              onChange={(e) => handleChange('minScore', e.target.value)}
            />
            {errors.minScore && <p className="text-red-500 text-xs mt-1">{errors.minScore}</p>}
          </div>
          <div>
            <label className="label">Max Score *</label>
            <input
              type="number"
              className={`input-field ${errors.maxScore ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
              placeholder="100"
              min={0}
              step={0.5}
              value={form.maxScore}
              onChange={(e) => handleChange('maxScore', e.target.value)}
            />
            {errors.maxScore && <p className="text-red-500 text-xs mt-1">{errors.maxScore}</p>}
          </div>
          <div>
            <label className="label">Grade Point</label>
            <input
              type="number"
              className={`input-field ${errors.gradePoint ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
              placeholder="4.0"
              min={0}
              step={0.1}
              value={form.gradePoint}
              onChange={(e) => handleChange('gradePoint', e.target.value)}
            />
            {errors.gradePoint && <p className="text-red-500 text-xs mt-1">{errors.gradePoint}</p>}
          </div>
          <div>
            <label className="label">System *</label>
            <select className="input-field" value={form.system} onChange={(e) => handleChange('system', e.target.value)}>
              {systemOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Remark</label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. Excellent, Good, Poor"
              value={form.remark}
              onChange={(e) => handleChange('remark', e.target.value)}
            />
          </div>
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => handleChange('isActive', e.target.checked)}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Is Active</span>
            </label>
          </div>
        </div>

        <div>
          <label className="label">Description</label>
          <textarea
            className="input-field"
            rows={2}
            placeholder="Optional description..."
            value={form.description}
            onChange={(e) => handleChange('description', e.target.value)}
          />
        </div>

        {rangeWarning && (
          <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <p className="text-sm text-amber-700 dark:text-amber-300 flex items-center gap-1">
              <span className="font-medium">Warning:</span> {rangeWarning}
            </p>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving...' : isEditing ? 'Update Grade Scale' : 'Create Grade Scale'}
          </button>
        </div>
      </form>
    </Modal>
  );
}