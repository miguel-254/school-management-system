import { useState, type FormEvent } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import type { Subject } from '../../types';

interface SubjectFormProps {
  subject?: Subject | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function SubjectForm({ subject, onSuccess, onCancel }: SubjectFormProps) {
  const isEdit = !!subject;
  const [form, setForm] = useState({
    name: subject?.name || '',
    code: subject?.code || '',
    description: subject?.description || '',
    department: subject?.department || '',
    category: subject?.category || 'core' as 'core' | 'elective' | 'optional',
    credits: subject?.credits ?? 1,
  });
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (field: string, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy[field];
        return copy;
      });
    }
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    if (!form.code.trim()) errs.code = 'Code is required';
    if (!form.category) errs.category = 'Category is required';
    if (form.credits < 0) errs.credits = 'Credits cannot be negative';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim(),
        description: form.description.trim() || undefined,
        department: form.department.trim() || undefined,
        category: form.category,
        credits: form.credits,
      };

      if (isEdit && subject) {
        await api.put(`/subjects/${subject._id}`, payload);
        toast.success('Subject updated');
      } else {
        await api.post('/subjects', payload);
        toast.success('Subject created');
      }
      onSuccess();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save subject');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="label">Name *</label>
          <input
            className={`input-field ${errors.name ? 'border-red-500' : ''}`}
            value={form.name}
            onChange={(e) => handleChange('name', e.target.value)}
            autoFocus
          />
          {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
        </div>
        <div>
          <label className="label">Code *</label>
          <input
            className={`input-field ${errors.code ? 'border-red-500' : ''}`}
            value={form.code}
            onChange={(e) => handleChange('code', e.target.value)}
          />
          {errors.code && <p className="text-red-500 text-xs mt-1">{errors.code}</p>}
        </div>
        <div>
          <label className="label">Department</label>
          <input
            className="input-field"
            value={form.department}
            onChange={(e) => handleChange('department', e.target.value)}
          />
        </div>
        <div>
          <label className="label">Category *</label>
          <select
            className={`input-field ${errors.category ? 'border-red-500' : ''}`}
            value={form.category}
            onChange={(e) => handleChange('category', e.target.value)}
          >
            <option value="core">Core</option>
            <option value="elective">Elective</option>
            <option value="optional">Optional</option>
          </select>
          {errors.category && <p className="text-red-500 text-xs mt-1">{errors.category}</p>}
        </div>
        <div>
          <label className="label">Credits</label>
          <input
            type="number"
            min={0}
            className={`input-field ${errors.credits ? 'border-red-500' : ''}`}
            value={form.credits}
            onChange={(e) => handleChange('credits', parseInt(e.target.value) || 0)}
          />
          {errors.credits && <p className="text-red-500 text-xs mt-1">{errors.credits}</p>}
        </div>
        <div className="md:col-span-2">
          <label className="label">Description</label>
          <textarea
            className="input-field"
            rows={2}
            value={form.description}
            onChange={(e) => handleChange('description', e.target.value)}
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Saving...' : isEdit ? 'Update Subject' : 'Create Subject'}
        </button>
      </div>
    </form>
  );
}
