import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../api/axios';
import type {
  Teacher,
  Subject,
  Class as ClassType,
  Stream,
  AcademicYear,
  Term,
  TeacherAssignment,
} from '../../types';
import { FaPlus, FaLayerGroup } from 'react-icons/fa';
import toast from 'react-hot-toast';
import DataTable, { type Column } from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';

interface AssignmentForm {
  teacher: string;
  class: string;
  subject: string;
  stream: string;
  academicYear: string;
  term: string;
}

const emptyForm: AssignmentForm = {
  teacher: '',
  class: '',
  subject: '',
  stream: '',
  academicYear: '',
  term: '',
};

const getRefId = (ref: any): string => {
  if (!ref) return '';
  return typeof ref === 'object' ? ref._id : ref;
};

const getRefName = (ref: any): string => {
  if (!ref) return '';
  return typeof ref === 'object' ? ref.name || ref.firstName || ref.employeeId || '' : ref;
};

export default function Assignments() {
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<ClassType[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [streams, setStreams] = useState<Stream[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [filterTeacher, setFilterTeacher] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterStream, setFilterStream] = useState('');
  const [filterSubject, setFilterSubject] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TeacherAssignment | null>(null);
  const [form, setForm] = useState<AssignmentForm>({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TeacherAssignment | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [assignmentsRes, teachersRes, classesRes, subjectsRes, streamsRes, yearsRes, termsRes] =
        await Promise.all([
          api.get('/assignments'),
          api.get('/teachers', { params: { limit: 500 } }),
          api.get('/classes'),
          api.get('/subjects'),
          api.get('/streams'),
          api.get('/academic-years'),
          api.get('/terms'),
        ]);
      setAssignments(assignmentsRes.data.data || []);
      setTeachers(teachersRes.data.data?.teachers || []);
      setClasses(classesRes.data.data || []);
      setSubjects(subjectsRes.data.data || []);
      setStreams(streamsRes.data.data || []);
      setYears(yearsRes.data.data || []);
      setTerms(termsRes.data.data || []);
    } catch {
      setError(true);
      toast.error('Failed to load assignments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const classStreams = useMemo(() => {
    const classObj = classes.find((c) => c._id === form.class);
    if (!classObj) return [];
    const classStreamIds = classObj.streams.map((s) => getRefId(s));
    return streams.filter((s) => classStreamIds.includes(s._id));
  }, [classes, streams, form.class]);

  const filteredTerms = useMemo(() => {
    if (!form.academicYear) return terms;
    return terms.filter((t) => getRefId(t.academicYear) === form.academicYear);
  }, [terms, form.academicYear]);

  const filteredAssignments = useMemo(() => {
    return assignments.filter((a) => {
      if (filterTeacher && getRefId(a.teacher) !== filterTeacher) return false;
      if (filterClass && getRefId(a.class) !== filterClass) return false;
      if (filterStream && getRefId(a.stream) !== filterStream) return false;
      if (filterSubject && getRefId(a.subject) !== filterSubject) return false;
      return true;
    });
  }, [assignments, filterTeacher, filterClass, filterStream, filterSubject]);

  const filteredStreamOptions = useMemo(() => {
    if (!filterClass) return streams;
    const classObj = classes.find((c) => c._id === filterClass);
    if (!classObj) return [];
    const ids = classObj.streams.map((s) => getRefId(s));
    return streams.filter((s) => ids.includes(s._id));
  }, [streams, classes, filterClass]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm });
    setFormOpen(true);
  };

  const openEdit = (assignment: TeacherAssignment) => {
    setEditing(assignment);
    setForm({
      teacher: getRefId(assignment.teacher),
      class: getRefId(assignment.class),
      subject: getRefId(assignment.subject),
      stream: getRefId(assignment.stream),
      academicYear: getRefId(assignment.academicYear),
      term: getRefId(assignment.term),
    });
    setFormOpen(true);
  };

  const handleChange = (field: keyof AssignmentForm, value: string) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'class') {
        next.stream = '';
      }
      if (field === 'academicYear') {
        next.term = '';
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!form.teacher || !form.class) {
      toast.error('Teacher and class are required');
      return;
    }
    if (!editing && !form.subject) {
      toast.error('Subject is required for teaching assignments');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        teacher: form.teacher,
        class: form.class,
        subject: form.subject || undefined,
        stream: form.stream || undefined,
        academicYear: form.academicYear || undefined,
        term: form.term || undefined,
      };
      if (editing) {
        await api.put(`/assignments/${editing._id}`, payload);
        toast.success('Assignment updated');
      } else {
        await api.post('/assignments', payload);
        toast.success('Assignment created');
      }
      setFormOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save assignment');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/assignments/${deleteTarget._id}`);
      toast.success('Assignment deleted');
      setDeleteTarget(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete assignment');
    } finally {
      setDeleting(false);
    }
  };

  const columns: Column<TeacherAssignment>[] = [
    {
      key: 'teacher',
      label: 'Teacher',
      render: (a) => {
        const t = a.teacher as any;
        return t && typeof t === 'object'
          ? `${t.firstName || ''} ${t.lastName || ''}`.trim() || t.employeeId
          : 'Unknown';
      },
    },
    {
      key: 'class',
      label: 'Class',
      render: (a) => {
        const c = a.class as any;
        return c && typeof c === 'object' ? c.name : '-';
      },
    },
    {
      key: 'subject',
      label: 'Subject',
      render: (a) => {
        const s = a.subject as any;
        return s && typeof s === 'object' ? s.name : (a.isClassTeacher ? 'Class Teacher' : '-');
      },
    },
    {
      key: 'stream',
      label: 'Stream',
      render: (a) => {
        const s = a.stream as any;
        return s && typeof s === 'object'
          ? <span className="badge badge-info">{s.name}</span>
          : <span className="badge badge-success">All streams</span>;
      },
    },
    {
      key: 'academicYear',
      label: 'Year / Term',
      render: (a) => {
        const y = a.academicYear as any;
        const t = a.term as any;
        const yearName = y && typeof y === 'object' ? (y.name || y.year) : '';
        const termName = t && typeof t === 'object' ? t.name : '';
        if (!yearName && !termName) return '-';
        return [termName, yearName].filter(Boolean).join(' · ');
      },
    },
    {
      key: 'teacherRole',
      label: 'Role',
      render: (a) => (
        <span className="badge badge-info">
          {a.teacherRole?.replace(/_/g, ' ') || 'subject teacher'}
        </span>
      ),
    },
  ];

  if (error) {
    return (
      <div className="space-y-6">
        <div className="page-header">
          <h1 className="page-title">Assignments</h1>
        </div>
        <div className="card flex flex-col items-center justify-center py-16">
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Failed to load assignments. Please try again.
          </p>
          <button className="btn-primary" onClick={fetchData}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Assignments</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage which teachers teach which subject in which class or stream.
          </p>
        </div>
        <button className="btn-primary" onClick={openCreate}>
          <FaPlus className="w-4 h-4 mr-1" />
          Add Assignment
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="label text-xs mb-1">Filter by Teacher</label>
          <select
            className="input-field"
            value={filterTeacher}
            onChange={(e) => setFilterTeacher(e.target.value)}
          >
            <option value="">All Teachers</option>
            {teachers.map((t) => (
              <option key={t._id} value={t._id}>
                {t.fullName || `${t.firstName} ${t.lastName}`}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label text-xs mb-1">Filter by Class</label>
          <select
            className="input-field"
            value={filterClass}
            onChange={(e) => {
              setFilterClass(e.target.value);
              setFilterStream('');
            }}
          >
            <option value="">All Classes</option>
            {classes.map((c) => (
              <option key={c._id} value={c._id}>
                {getRefName(c)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label text-xs mb-1">Filter by Stream</label>
          <select
            className="input-field"
            value={filterStream}
            onChange={(e) => setFilterStream(e.target.value)}
            disabled={!filterClass}
          >
            <option value="">All Streams</option>
            {filteredStreamOptions.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label text-xs mb-1">Filter by Subject</label>
          <select
            className="input-field"
            value={filterSubject}
            onChange={(e) => setFilterSubject(e.target.value)}
          >
            <option value="">All Subjects</option>
            {subjects.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <DataTable<TeacherAssignment>
        columns={columns}
        data={filteredAssignments}
        loading={loading}
        onEdit={openEdit}
        onDelete={(a) => setDeleteTarget(a)}
      />

      <Modal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Edit Assignment' : 'Add Assignment'}
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="label text-xs mb-1">Teacher *</label>
            <select
              className="input-field"
              value={form.teacher}
              onChange={(e) => handleChange('teacher', e.target.value)}
            >
              <option value="">Select teacher</option>
              {teachers.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.fullName || `${t.firstName} ${t.lastName}`} ({t.employeeId})
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label text-xs mb-1">Class *</label>
              <select
                className="input-field"
                value={form.class}
                onChange={(e) => handleChange('class', e.target.value)}
              >
                <option value="">Select class</option>
                {classes.map((c) => (
                  <option key={c._id} value={c._id}>
                    {getRefName(c)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label text-xs mb-1">Stream (empty = all streams)</label>
              <select
                className="input-field"
                value={form.stream}
                onChange={(e) => handleChange('stream', e.target.value)}
                disabled={!form.class}
              >
                <option value="">All streams</option>
                {classStreams.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label text-xs mb-1">Subject *</label>
            <select
              className="input-field"
              value={form.subject}
              onChange={(e) => handleChange('subject', e.target.value)}
            >
              <option value="">Select subject</option>
              {subjects.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label text-xs mb-1">Academic Year</label>
              <select
                className="input-field"
                value={form.academicYear}
                onChange={(e) => handleChange('academicYear', e.target.value)}
              >
                <option value="">Not specified</option>
                {years.map((y) => (
                  <option key={y._id} value={y._id}>
                    {y.name || y.year}
                    {y.isCurrent ? ' (current)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label text-xs mb-1">Term</label>
              <select
                className="input-field"
                value={form.term}
                onChange={(e) => handleChange('term', e.target.value)}
                disabled={!form.academicYear}
              >
                <option value="">Not specified</option>
                {filteredTerms.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button className="btn-secondary" onClick={() => setFormOpen(false)}>
              Cancel
            </button>
            <button className="btn-primary" disabled={saving} onClick={handleSubmit}>
              {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Confirm Delete"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-600 dark:text-gray-400">
            Are you sure you want to remove this assignment? The teacher will no longer be
            assigned to this class/stream for the subject.
          </p>
          <div className="flex justify-end gap-3">
            <button className="btn-secondary" onClick={() => setDeleteTarget(null)}>
              Cancel
            </button>
            <button className="btn-danger" disabled={deleting} onClick={confirmDelete}>
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
