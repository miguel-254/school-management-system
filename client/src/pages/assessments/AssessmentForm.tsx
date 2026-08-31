import { useState, useEffect } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import Modal from '../../components/common/Modal';
import type { Assessment, AssessmentType, Class, Subject, AcademicYear, ApiResponse } from '../../types';
import { FaSpinner } from 'react-icons/fa';

interface AssessmentFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  assessment?: Assessment | null;
}

const assessmentTypes: { value: AssessmentType; label: string }[] = [
  { value: 'assignment', label: 'Assignment' },
  { value: 'classExercise', label: 'Class Exercise' },
  { value: 'cat', label: 'CAT' },
  { value: 'project', label: 'Project' },
  { value: 'practical', label: 'Practical' },
  { value: 'midTerm', label: 'Mid Term' },
  { value: 'endTerm', label: 'End Term' },
  { value: 'finalExam', label: 'Final Exam' },
];

const initialForm = {
  name: '',
  code: '',
  type: '' as AssessmentType | '',
  academicYearId: '',
  termId: '',
  classId: '',
  streamId: '',
  subjectId: '',
  maxScore: '',
  weight: '',
  examDate: '',
  releaseDate: '',
  duration: '',
  instructions: '',
  isRequired: true,
};

export default function AssessmentForm({ isOpen, onClose, onSuccess, assessment }: AssessmentFormProps) {
  const [form, setForm] = useState(initialForm);
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [filteredSubjects, setFilteredSubjects] = useState<Subject[]>([]);
  const [streams, setStreams] = useState<{ _id: string; name: string }[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [terms, setTerms] = useState<{ _id: string; name: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const isEditing = !!assessment;

  useEffect(() => {
    if (isOpen) {
      const fetchData = async () => {
        try {
          const [classesRes, subjectsRes, yearsRes] = await Promise.all([
            api.get<ApiResponse<Class[]>>('/classes'),
            api.get<ApiResponse<Subject[]>>('/subjects'),
            api.get<ApiResponse<AcademicYear[]>>('/academic-years'),
          ]);
          setClasses(classesRes.data.data || []);
          setSubjects(subjectsRes.data.data || []);
          setAcademicYears(yearsRes.data.data || []);
        } catch {
          toast.error('Failed to load form data');
        }
      };
      fetchData();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && assessment) {
      const cls = typeof assessment.class === 'object' ? (assessment as any).class?._id || '' : '';
      const subj = typeof assessment.subject === 'object' ? (assessment as any).subject?._id || '' : '';
      const stream = (typeof assessment.stream === 'object') ? ((assessment as any).stream?._id || '') : (assessment.stream || '');
      const acadYear = typeof assessment.academicYear === 'object' ? (assessment as any).academicYear?._id || '' : (assessment.academicYear || '');
      const trm = typeof assessment.term === 'object' ? (assessment as any).term?._id || '' : (assessment.term || '');
      setForm({
        name: assessment.name,
        code: assessment.code,
        type: assessment.type,
        academicYearId: acadYear,
        termId: trm,
        classId: cls || (typeof assessment.class === 'string' ? assessment.class : ''),
        streamId: stream,
        subjectId: subj || (typeof assessment.subject === 'string' ? assessment.subject : ''),
        maxScore: String(assessment.maxScore),
        weight: String(assessment.weight),
        examDate: assessment.examDate ? assessment.examDate.split('T')[0] : '',
        releaseDate: assessment.releaseDate ? assessment.releaseDate.split('T')[0] : '',
        duration: assessment.duration ? String(assessment.duration) : '',
        instructions: assessment.instructions || '',
        isRequired: assessment.isRequired,
      });
    } else if (isOpen && !assessment) {
      setForm(initialForm);
    }
  }, [isOpen, assessment]);

  useEffect(() => {
    if (form.academicYearId) {
      const fetchTerms = async () => {
        try {
          const res = await api.get<ApiResponse<AcademicYear>>(`/academic-years/${form.academicYearId}`);
          const year = res.data.data;
          if (year?.terms) {
            setTerms(year.terms.map((t) => {
              if (typeof t === 'object') return { _id: t._id, name: t.name };
              return { _id: t, name: t };
            }));
          }
        } catch {
          setTerms([]);
        }
      };
      fetchTerms();
    } else {
      setTerms([]);
    }
  }, [form.academicYearId]);

  useEffect(() => {
    if (form.classId) {
      const cls = classes.find((c) => c._id === form.classId);
      if (cls?.streams) {
        setStreams(cls.streams.map((s) => (typeof s === 'object' ? { _id: s._id, name: s.name } : { _id: s, name: s })));
      } else {
        setStreams([]);
      }
      const classSubjectIds = cls?.subjects?.map((s) => (typeof s === 'string' ? s : s._id)) || [];
      setFilteredSubjects(subjects.filter((s) => classSubjectIds.includes(s._id)));
    } else {
      setStreams([]);
      setFilteredSubjects(subjects);
    }
  }, [form.classId, classes, subjects]);

  const validate = (): string | null => {
    if (!form.name) return 'Name is required';
    if (!form.type) return 'Type is required';
    if (!form.academicYearId) return 'Academic year is required';
    if (!form.termId) return 'Term is required';
    if (!form.subjectId) return 'Subject is required';
    if (!form.classId) return 'Class is required';
    if (!form.maxScore || Number(form.maxScore) <= 0) return 'Max score must be greater than 0';
    if (!form.weight || Number(form.weight) < 0 || Number(form.weight) > 100) return 'Weight must be between 0 and 100';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const error = validate();
    if (error) {
      toast.error(error);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: form.name,
        code: form.code || `${form.type.toUpperCase()}-${Date.now()}`,
        type: form.type,
        academicYear: form.academicYearId,
        term: form.termId,
        class: form.classId,
        stream: form.streamId || undefined,
        subject: form.subjectId,
        maxScore: Number(form.maxScore),
        weight: Number(form.weight),
        examDate: form.examDate || undefined,
        releaseDate: form.releaseDate || undefined,
        duration: form.duration ? Number(form.duration) : undefined,
        instructions: form.instructions || undefined,
        isRequired: form.isRequired,
      };

      if (isEditing && assessment) {
        await api.put(`/assessments/${assessment._id}`, payload);
        toast.success('Assessment updated');
      } else {
        await api.post('/assessments', payload);
        toast.success('Assessment created');
      }
      onSuccess();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save assessment');
    } finally {
      setSubmitting(false);
    }
  };

  const updateField = (field: string, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field === 'classId') {
      setForm((prev) => ({ ...prev, classId: value, streamId: '', subjectId: '' }));
    }
    if (field === 'academicYearId') {
      setForm((prev) => ({ ...prev, academicYearId: value, termId: '' }));
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? 'Edit Assessment' : 'Create Assessment'} size="xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Name *</label>
            <input
              className="input-field"
              placeholder="Assessment name"
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">Code</label>
            <input
              className="input-field"
              placeholder="Auto-generated if empty"
              value={form.code}
              onChange={(e) => updateField('code', e.target.value)}
            />
          </div>
          <div>
            <label className="label">Type *</label>
            <select
              className="input-field"
              value={form.type}
              onChange={(e) => updateField('type', e.target.value)}
              required
            >
              <option value="">Select type</option>
              {assessmentTypes.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Academic Year <span className="text-red-500">*</span></label>
            <select
              className="input-field"
              value={form.academicYearId}
              onChange={(e) => updateField('academicYearId', e.target.value)}
              required
            >
              <option value="">Select academic year</option>
              {academicYears.map((y) => (
                <option key={y._id} value={y._id}>{y.name}{y.isCurrent ? ' (Current)' : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Term <span className="text-red-500">*</span></label>
            <select
              className="input-field"
              value={form.termId}
              onChange={(e) => updateField('termId', e.target.value)}
              required
            >
              <option value="">Select term</option>
              {terms.map((t) => (
                <option key={t._id} value={t._id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Class <span className="text-red-500">*</span></label>
            <select
              className="input-field"
              value={form.classId}
              onChange={(e) => updateField('classId', e.target.value)}
              required
            >
              <option value="">Select class</option>
              {classes.map((c) => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Subject <span className="text-red-500">*</span></label>
            <select
              className="input-field"
              value={form.subjectId}
              onChange={(e) => updateField('subjectId', e.target.value)}
              required
            >
              <option value="">Select subject</option>
              {filteredSubjects.map((s) => (
                <option key={s._id} value={s._id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Stream</label>
            <select
              className="input-field"
              value={form.streamId}
              onChange={(e) => updateField('streamId', e.target.value)}
            >
              <option value="">None</option>
              {streams.map((s) => (
                <option key={s._id} value={s._id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Max Score *</label>
            <input
              type="number"
              min={1}
              className="input-field"
              placeholder="e.g. 100"
              value={form.maxScore}
              onChange={(e) => updateField('maxScore', e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">Weight % *</label>
            <input
              type="number"
              min={0}
              max={100}
              className="input-field"
              placeholder="e.g. 20"
              value={form.weight}
              onChange={(e) => updateField('weight', e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">Exam Date</label>
            <input
              type="date"
              className="input-field"
              value={form.examDate}
              onChange={(e) => updateField('examDate', e.target.value)}
            />
          </div>
          <div>
            <label className="label">Release Date</label>
            <input
              type="date"
              className="input-field"
              value={form.releaseDate}
              onChange={(e) => updateField('releaseDate', e.target.value)}
            />
            <p className="text-xs text-gray-500 mt-1">Assessment auto-releases to subject teachers on this date</p>
          </div>
          <div>
            <label className="label">Duration (minutes)</label>
            <input
              type="number"
              min={1}
              className="input-field"
              placeholder="e.g. 60"
              value={form.duration}
              onChange={(e) => updateField('duration', e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="label">Instructions</label>
          <textarea
            className="input-field"
            rows={3}
            placeholder="Instructions for the assessment..."
            value={form.instructions}
            onChange={(e) => updateField('instructions', e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isRequired"
            className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
            checked={form.isRequired}
            onChange={(e) => updateField('isRequired', e.target.checked)}
          />
          <label htmlFor="isRequired" className="text-sm text-gray-700 dark:text-gray-300">
            Is Required
          </label>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? (
              <>
                <FaSpinner className="w-4 h-4 mr-1 animate-spin" />
                Saving...
              </>
            ) : (
              isEditing ? 'Update Assessment' : 'Create Assessment'
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}