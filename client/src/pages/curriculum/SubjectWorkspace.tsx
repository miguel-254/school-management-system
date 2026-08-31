import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import {
  FaArrowLeft, FaPlus, FaChevronDown, FaChevronRight, FaCheckCircle, FaCircle,
  FaEdit, FaTrash, FaArrowUp, FaArrowDown, FaBook, FaSchool, FaCalendarAlt,
  FaUserTie, FaPlay, FaUndo, FaSearch, FaFilter, FaLink, FaChevronCircleRight,
} from 'react-icons/fa';
import Modal from '../../components/common/Modal';
import type { CurriculumAssignment, CurriculumTopic, CurriculumLesson, LessonResource, LessonEvent } from '../../types';

const STATUS_META: Record<string, { label: string; cls: string }> = {
  not_started: { label: 'Not Started', cls: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' },
  in_progress: { label: 'In Progress', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  completed: { label: 'Completed', cls: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
};

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] || STATUS_META.not_started;
  return <span className={`badge ${meta.cls}`}>{meta.label}</span>;
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'completed') return <FaCheckCircle className="w-5 h-5 text-green-500 shrink-0" />;
  if (status === 'in_progress') return <FaCircle className="w-5 h-5 text-amber-400 shrink-0" />;
  return <FaCircle className="w-5 h-5 text-gray-300 dark:text-gray-600 shrink-0" />;
}

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="w-full h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${percent >= 100 ? 'bg-green-500' : 'bg-blue-500'}`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

function StringListEditor({
  values,
  onChange,
  placeholder,
  addLabel,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
  addLabel: string;
}) {
  const update = (i: number, v: string) => {
    const next = [...values];
    next[i] = v;
    onChange(next);
  };
  return (
    <div className="space-y-2">
      {values.map((v, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            className="input-field"
            value={v}
            placeholder={placeholder}
            onChange={(e) => update(i, e.target.value)}
          />
          <button
            type="button"
            className="text-gray-400 hover:text-red-500 transition-colors shrink-0"
            onClick={() => onChange(values.filter((_, j) => j !== i))}
            aria-label="Remove"
          >
            <FaTrash className="w-4 h-4" />
          </button>
        </div>
      ))}
      <button type="button" className="btn-secondary text-xs" onClick={() => onChange([...values, ''])}>
        <FaPlus className="w-3 h-3 mr-1" />
        {addLabel}
      </button>
    </div>
  );
}

// ─── Topic form ─────────────────────────────────────────────────────
function TopicFormModal({
  isOpen,
  onClose,
  onSaved,
  assignmentId,
  topic,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  assignmentId: string;
  topic: CurriculumTopic | null;
}) {
  const [form, setForm] = useState({ title: '', description: '', estimatedLessons: '', notes: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setForm({
        title: topic?.title || '',
        description: topic?.description || '',
        estimatedLessons: topic?.estimatedLessons != null ? String(topic.estimatedLessons) : '',
        notes: topic?.notes || '',
      });
    }
  }, [isOpen, topic]);

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast.error('Topic title cannot be empty.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        description: form.description,
        estimatedLessons: form.estimatedLessons ? Number(form.estimatedLessons) : undefined,
        notes: form.notes,
      };
      if (topic) {
        await api.put(`/curriculum/topics/${topic._id}`, payload);
        toast.success('Topic updated');
      } else {
        await api.post(`/curriculum/assignments/${assignmentId}/topics`, payload);
        toast.success('Topic created');
      }
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Unable to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={topic ? 'Edit Topic' : 'Add Topic'} size="lg">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Topic title *</label>
          <input className="input-field" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Fractions" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
          <textarea className="input-field" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What will this topic cover?" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Estimated lessons</label>
            <input className="input-field" type="number" min={0} value={form.estimatedLessons} onChange={(e) => setForm({ ...form, estimatedLessons: e.target.value })} placeholder="Optional" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
            <input className="input-field" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional" />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : topic ? 'Save Changes' : 'Create Topic'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Lesson form ────────────────────────────────────────────────────
function LessonFormModal({
  isOpen,
  onClose,
  onSaved,
  assignmentId,
  topicId,
  lesson,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  assignmentId: string;
  topicId: string;
  lesson: CurriculumLesson | null;
}) {
  const [form, setForm] = useState({
    title: '', duration: '', objectives: [] as string[], outline: [] as string[],
    notes: '', homework: '', assessmentNotes: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setForm({
        title: lesson?.title || '',
        duration: lesson?.duration != null ? String(lesson.duration) : '',
        objectives: lesson?.objectives?.length ? [...lesson.objectives] : [''],
        outline: lesson?.outline?.length ? [...lesson.outline] : [''],
        notes: lesson?.notes || '',
        homework: lesson?.homework || '',
        assessmentNotes: lesson?.assessmentNotes || '',
      });
    }
  }, [isOpen, lesson]);

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast.error('Lesson title cannot be empty.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        duration: form.duration ? Number(form.duration) : undefined,
        objectives: form.objectives.filter((o) => o.trim()),
        outline: form.outline.filter((o) => o.trim()),
        notes: form.notes,
        homework: form.homework,
        assessmentNotes: form.assessmentNotes,
      };
      if (lesson) {
        await api.put(`/curriculum/lessons/${lesson._id}`, payload);
        toast.success('Lesson updated');
      } else {
        await api.post(`/curriculum/assignments/${assignmentId}/topics/${topicId}/lessons`, payload);
        toast.success('Lesson created');
      }
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Unable to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={lesson ? 'Edit Lesson' : 'Add Lesson'} size="xl">
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Lesson title *</label>
            <input className="input-field" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Equivalent Fractions" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Duration (minutes)</label>
            <input className="input-field" type="number" min={0} value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} placeholder="e.g. 40" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Lesson objectives</label>
          <StringListEditor values={form.objectives} onChange={(v) => setForm({ ...form, objectives: v })} placeholder="e.g. Define equivalent fractions." addLabel="Add objective" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Lesson outline</label>
          <StringListEditor values={form.outline} onChange={(v) => setForm({ ...form, outline: v })} placeholder="e.g. Introduction" addLabel="Add outline step" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Teaching notes</label>
          <textarea className="input-field" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes for teaching this lesson" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Homework / activity</label>
            <textarea className="input-field" rows={2} value={form.homework} onChange={(e) => setForm({ ...form, homework: e.target.value })} placeholder="Optional" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Assessment notes</label>
            <textarea className="input-field" rows={2} value={form.assessmentNotes} onChange={(e) => setForm({ ...form, assessmentNotes: e.target.value })} placeholder="Optional" />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : lesson ? 'Save Changes' : 'Create Lesson'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Lesson detail ──────────────────────────────────────────────────
const RESOURCE_TYPES = ['pdf', 'document', 'image', 'video', 'url', 'worksheet', 'presentation', 'other'];

function LessonDetailModal({
  lessonId,
  onClose,
  onChanged,
}: {
  lessonId: string | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [lesson, setLesson] = useState<CurriculumLesson | null>(null);
  const [events, setEvents] = useState<LessonEvent[]>([]);
  const [resources, setResources] = useState<LessonResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [resourceForm, setResourceForm] = useState({ title: '', description: '', type: 'url', url: '' });

  const load = useCallback(async () => {
    if (!lessonId) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/curriculum/lessons/${lessonId}`);
      setLesson(data.data.lesson);
      setEvents(data.data.events || []);
      setResources(data.data.resources || []);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lesson could not be found.');
      onClose();
    } finally {
      setLoading(false);
    }
  }, [lessonId, onClose]);

  useEffect(() => {
    if (lessonId) load();
  }, [lessonId, load]);

  const completeOrReopen = async () => {
    if (!lesson) return;
    setBusy(true);
    try {
      if (lesson.status === 'completed') {
        await api.post(`/curriculum/lessons/${lesson._id}/reopen`);
        toast.success('Lesson reopened');
      } else {
        await api.post(`/curriculum/lessons/${lesson._id}/complete`);
        toast.success('Lesson successfully marked as completed.');
      }
      await load();
      onChanged();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Unable to update lesson status.');
    } finally {
      setBusy(false);
    }
  };

  const addResource = async () => {
    if (!resourceForm.title.trim() || !resourceForm.url.trim()) {
      toast.error('Resource title and URL are required.');
      return;
    }
    setBusy(true);
    try {
      await api.post(`/curriculum/lessons/${lessonId}/resources`, resourceForm);
      toast.success('Resource added');
      setResourceForm({ title: '', description: '', type: 'url', url: '' });
      await load();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Unable to add resource.');
    } finally {
      setBusy(false);
    }
  };

  const deleteResource = async (r: LessonResource) => {
    if (!confirm(`Remove resource "${r.title}"?`)) return;
    try {
      await api.delete(`/curriculum/resources/${r._id}`);
      toast.success('Resource removed');
      await load();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Unable to remove resource.');
    }
  };

  return (
    <Modal isOpen={!!lessonId} onClose={onClose} title={loading ? 'Lesson' : lesson?.title || 'Lesson'} size="xl">
      {loading || !lesson ? (
        <div className="h-40 animate-pulse bg-gray-100 dark:bg-gray-700 rounded-lg" />
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={lesson.status} />
            {lesson.duration != null && (
              <span className="badge bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">{lesson.duration} min</span>
            )}
            <span className="badge bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">Lesson {lesson.order}</span>
          </div>

          {lesson.status === 'completed' && (
            <p className="text-sm text-green-600 dark:text-green-400">
              ✓ Completed {formatDate(lesson.completedAt)}
            </p>
          )}

          <button
            className={`${lesson.status === 'completed' ? 'btn-secondary' : 'btn-primary'} w-full sm:w-auto`}
            onClick={completeOrReopen}
            disabled={busy}
          >
            {lesson.status === 'completed' ? (
              <><FaUndo className="w-4 h-4 mr-1.5" /> Reopen Lesson</>
            ) : (
              <><FaCheckCircle className="w-4 h-4 mr-1.5" /> Mark Lesson as Completed</>
            )}
          </button>

          {lesson.objectives?.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Objectives</h4>
              <ul className="space-y-1.5">
                {lesson.objectives.map((o, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <FaChevronCircleRight className="w-3.5 h-3.5 text-primary-500 mt-0.5 shrink-0" />
                    {o}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {lesson.outline?.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Lesson Outline</h4>
              <ol className="space-y-1.5 list-decimal list-inside text-sm text-gray-700 dark:text-gray-300">
                {lesson.outline.map((o, i) => (
                  <li key={i}>{o}</li>
                ))}
              </ol>
            </div>
          )}

          {lesson.notes && (
            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Teaching Notes</h4>
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{lesson.notes}</p>
            </div>
          )}

          {lesson.homework && (
            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Homework / Activity</h4>
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{lesson.homework}</p>
            </div>
          )}

          {lesson.assessmentNotes && (
            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Assessment Notes</h4>
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{lesson.assessmentNotes}</p>
            </div>
          )}

          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Resources ({resources.length})</h4>
            {resources.length > 0 && (
              <div className="space-y-2 mb-3">
                {resources.map((r) => (
                  <div key={r._id} className="flex items-center justify-between gap-2 p-2.5 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <div className="min-w-0">
                      <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary-600 dark:text-primary-300 hover:underline truncate block">
                        {r.title}
                      </a>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {r.type.toUpperCase()} {r.description ? `— ${r.description}` : ''}
                      </p>
                    </div>
                    <button className="text-gray-400 hover:text-red-500 shrink-0" onClick={() => deleteResource(r)} aria-label="Delete resource">
                      <FaTrash className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input className="input-field" placeholder="Resource title *" value={resourceForm.title} onChange={(e) => setResourceForm({ ...resourceForm, title: e.target.value })} />
              <select className="input-field" value={resourceForm.type} onChange={(e) => setResourceForm({ ...resourceForm, type: e.target.value })}>
                {RESOURCE_TYPES.map((t) => (
                  <option key={t} value={t}>{t.toUpperCase()}</option>
                ))}
              </select>
              <input className="input-field" placeholder="URL or file link *" value={resourceForm.url} onChange={(e) => setResourceForm({ ...resourceForm, url: e.target.value })} />
              <input className="input-field" placeholder="Description (optional)" value={resourceForm.description} onChange={(e) => setResourceForm({ ...resourceForm, description: e.target.value })} />
            </div>
            <button className="btn-secondary text-xs mt-2" onClick={addResource} disabled={busy}>
              <FaPlus className="w-3 h-3 mr-1" />
              Add Resource
            </button>
          </div>

          {events.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Completion History</h4>
              <div className="space-y-1.5">
                {events.map((e) => (
                  <p key={e._id} className="text-xs text-gray-500 dark:text-gray-400">
                    {e.action === 'completed' ? '✓ Completed' : '↩ Reopened'} by{' '}
                    {typeof e.by === 'object' && e.by?.fullName ? e.by.fullName : 'teacher'} on{' '}
                    {new Date(e.at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

// ─── Main workspace ─────────────────────────────────────────────────
export default function SubjectWorkspace() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const navigate = useNavigate();

  const [assignment, setAssignment] = useState<CurriculumAssignment | null>(null);
  const [topics, setTopics] = useState<CurriculumTopic[]>([]);
  const [allAssignments, setAllAssignments] = useState<CurriculumAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const [topicModal, setTopicModal] = useState<{ open: boolean; topic: CurriculumTopic | null }>({ open: false, topic: null });
  const [lessonModal, setLessonModal] = useState<{ open: boolean; topicId: string; lesson: CurriculumLesson | null }>({ open: false, topicId: '', lesson: null });
  const [detailLessonId, setDetailLessonId] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [topicFilter, setTopicFilter] = useState('');

  const load = useCallback(async () => {
    if (!assignmentId) return;
    setLoading(true);
    try {
      const [overviewRes, topicsRes, subjectsRes] = await Promise.all([
        api.get(`/curriculum/assignments/${assignmentId}`),
        api.get(`/curriculum/assignments/${assignmentId}/topics`),
        api.get('/curriculum/subjects'),
      ]);
      setAssignment(overviewRes.data.data);
      setTopics(topicsRes.data.data || []);
      setAllAssignments(subjectsRes.data.data || []);
    } catch (err: any) {
      if (err.response?.status === 403) {
        toast.error(err.response?.data?.message || 'You are not authorized to access this teaching assignment.');
        navigate('/my-subjects');
      } else {
        toast.error(err.response?.data?.message || 'Failed to load subject workspace.');
      }
    } finally {
      setLoading(false);
    }
  }, [assignmentId, navigate]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredTopics = useMemo(() => {
    const q = search.toLowerCase();
    return topics
      .map((t) => {
        const lessons = t.lessons.filter((l) => {
          if (statusFilter && l.status !== statusFilter) return false;
          if (q && !l.title.toLowerCase().includes(q)) return false;
          return true;
        });
        return { ...t, lessons };
      })
      .filter((t) => {
        if (topicFilter && t._id !== topicFilter) return false;
        if (q && !t.title.toLowerCase().includes(q) && t.lessons.length === 0) return false;
        return true;
      });
  }, [topics, search, statusFilter, topicFilter]);

  const moveTopic = async (index: number, dir: -1 | 1) => {
    const ids = topics.map((t) => t._id);
    const j = index + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    try {
      await api.post(`/curriculum/assignments/${assignmentId}/topics/reorder`, { ids });
      toast.success('Topics reordered');
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Unable to reorder topics.');
    }
  };

  const moveLesson = async (topicId: string, index: number, dir: -1 | 1) => {
    const topic = topics.find((t) => t._id === topicId);
    if (!topic) return;
    const ids = topic.lessons.map((l) => l._id);
    const j = index + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    try {
      await api.post(`/curriculum/assignments/${assignmentId}/topics/${topicId}/lessons/reorder`, { ids });
      toast.success('Lessons reordered');
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Unable to reorder lessons.');
    }
  };

  const deleteTopic = async (t: CurriculumTopic) => {
    const lessonCount = t.lessons.length;
    if (!confirm(`Delete topic "${t.title}"${lessonCount > 0 ? ` and its ${lessonCount} lesson(s)` : ''}? This cannot be undone.`)) return;
    try {
      await api.delete(`/curriculum/topics/${t._id}`);
      toast.success(`Topic "${t.title}" deleted`);
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Unable to delete topic.');
    }
  };

  const deleteLesson = async (l: CurriculumLesson) => {
    if (!confirm(`Delete lesson "${l.title}"?`)) return;
    try {
      await api.delete(`/curriculum/lessons/${l._id}`);
      toast.success('Lesson deleted');
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Unable to delete lesson.');
    }
  };

  const quickComplete = async (l: CurriculumLesson) => {
    try {
      await api.post(`/curriculum/lessons/${l._id}/complete`);
      toast.success('Lesson successfully marked as completed.');
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Unable to update lesson.');
    }
  };

  const switchAssignment = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (e.target.value) navigate(`/curriculum/${e.target.value}`);
  };

  if (loading && !assignment) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 w-64 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        <div className="h-40 bg-gray-200 dark:bg-gray-700 rounded-xl" />
        <div className="h-80 bg-gray-200 dark:bg-gray-700 rounded-xl" />
      </div>
    );
  }

  if (!assignment) return null;

  const stats = assignment.stats;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <Link to="/my-subjects" className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
          <FaArrowLeft className="w-4 h-4" />
          My Subjects
        </Link>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500 dark:text-gray-400 shrink-0">Switch Assignment:</label>
          <select className="input-field w-full sm:w-72" value={assignmentId} onChange={switchAssignment}>
            {allAssignments.map((a) => (
              <option key={a._id} value={a._id}>
                {a.subject?.name} • {a.class?.name} {a.stream?.name ? a.stream.name : '(All)'}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="card p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start gap-4 min-w-0">
            <div className="w-14 h-14 bg-primary-100 dark:bg-primary-900/40 rounded-2xl flex items-center justify-center shrink-0">
              <FaBook className="w-6 h-6 text-primary-600 dark:text-primary-300" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white truncate">
                {assignment.subject?.name}
              </h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-gray-600 dark:text-gray-300">
                <span className="flex items-center gap-1.5">
                  <FaSchool className="w-3.5 h-3.5 text-gray-400" />
                  {assignment.class?.name} <span className="text-gray-400">→</span> {assignment.stream?.name || 'All streams'}
                </span>
                <span className="flex items-center gap-1.5">
                  <FaCalendarAlt className="w-3.5 h-3.5 text-gray-400" />
                  {assignment.term?.name || 'Current'} <span className="text-gray-400">→</span> {assignment.academicYear?.name || '—'}
                </span>
                <span className="flex items-center gap-1.5">
                  <FaUserTie className="w-3.5 h-3.5 text-gray-400" />
                  {assignment.teacherName}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button className="btn-primary" onClick={() => setTopicModal({ open: true, topic: null })}>
              <FaPlus className="w-4 h-4 mr-1.5" />
              Add Topic
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <p className="text-xs text-gray-500 dark:text-gray-400">Topics</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">{stats.completedTopics}/{stats.totalTopics}</p>
          </div>
          <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <p className="text-xs text-gray-500 dark:text-gray-400">Lessons</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">{stats.completedLessons}/{stats.totalLessons}</p>
          </div>
          <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg col-span-2">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs text-gray-500 dark:text-gray-400">Overall Progress</p>
              <p className={`text-sm font-semibold ${stats.overallPercent >= 100 ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'}`}>
                {stats.overallPercent}%
              </p>
            </div>
            <ProgressBar percent={stats.overallPercent} />
          </div>
        </div>
      </div>

      {stats.currentLesson && (
        <div className="card p-4 border-amber-200 dark:border-amber-900/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 bg-amber-100 dark:bg-amber-900/40 rounded-lg flex items-center justify-center shrink-0">
              <FaPlay className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Continue Teaching</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {stats.currentTopic?.title} — Lesson: {stats.currentLesson.title}
              </p>
            </div>
          </div>
          <button className="btn-primary shrink-0" onClick={() => setDetailLessonId(stats.currentLesson?._id || null)}>
            Open Lesson
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input-field pl-10" placeholder="Search lessons…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input-field sm:w-44" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="not_started">Not Started</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
        </select>
        <select className="input-field sm:w-52" value={topicFilter} onChange={(e) => setTopicFilter(e.target.value)}>
          <option value="">All Topics</option>
          {topics.map((t) => (
            <option key={t._id} value={t._id}>{t.title}</option>
          ))}
        </select>
      </div>

      <div className="space-y-3">
        {filteredTopics.length === 0 ? (
          <div className="card p-10 text-center">
            <FaBook className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">
              {topics.length === 0 ? 'No topics yet. Add your first topic to start planning.' : 'No topics match your filters.'}
            </p>
          </div>
        ) : (
          filteredTopics.map((topic, ti) => {
            const isExpanded = expanded[topic._id] ?? true;
            const lessons = topic.lessons;
            return (
              <div key={topic._id} className="card overflow-hidden">
                <div className="flex items-center gap-3 p-4">
                  <button onClick={() => setExpanded({ ...expanded, [topic._id]: !isExpanded })} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 shrink-0" aria-label="Expand/collapse">
                    {isExpanded ? <FaChevronDown className="w-4 h-4" /> : <FaChevronRight className="w-4 h-4" />}
                  </button>
                  <StatusIcon status={topic.status} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-semibold text-gray-900 dark:text-white">{topic.title}</h3>
                      <StatusBadge status={topic.status} />
                    </div>
                    {topic.description && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{topic.description}</p>
                    )}
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      {lessons.length > 0 ? `${topic.completedLessons}/${lessons.length} lessons completed` : 'No lessons yet'}
                      {topic.estimatedLessons ? ` • ~${topic.estimatedLessons} lessons planned` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button className="icon-btn" onClick={() => moveTopic(ti, -1)} disabled={ti === 0} aria-label="Move up">
                      <FaArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button className="icon-btn" onClick={() => moveTopic(ti, 1)} disabled={ti === topics.length - 1} aria-label="Move down">
                      <FaArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button className="icon-btn" onClick={() => setTopicModal({ open: true, topic })} aria-label="Edit topic">
                      <FaEdit className="w-3.5 h-3.5" />
                    </button>
                    <button className="icon-btn" onClick={() => deleteTopic(topic)} aria-label="Delete topic">
                      <FaTrash className="w-3.5 h-3.5" />
                    </button>
                    <button
                      className="btn-secondary text-xs ml-2"
                      onClick={() => setLessonModal({ open: true, topicId: topic._id, lesson: null })}
                    >
                      <FaPlus className="w-3 h-3 mr-1" />
                      Add Lesson
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-100 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
                    {lessons.length === 0 ? (
                      <p className="p-4 text-sm text-gray-400 dark:text-gray-500">No lessons in this topic yet.</p>
                    ) : (
                      lessons.map((lesson, li) => (
                        <div key={lesson._id} className="flex items-center gap-3 p-3 sm:px-4 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
                          <StatusIcon status={lesson.status} />
                          <button className="min-w-0 flex-1 text-left" onClick={() => setDetailLessonId(lesson._id)}>
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              Lesson {lesson.order}: {lesson.title}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {lesson.duration ? `${lesson.duration} min • ` : ''}
                              {lesson.objectives?.length || 0} objectives • {lesson.resourceCount || 0} resources
                              {lesson.status === 'completed' && lesson.completedAt ? ` • Completed ${formatDate(lesson.completedAt)}` : ''}
                            </p>
                          </button>
                          <div className="flex items-center gap-1 shrink-0">
                            <button className="icon-btn" onClick={() => moveLesson(topic._id, li, -1)} disabled={li === 0} aria-label="Move up">
                              <FaArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button className="icon-btn" onClick={() => moveLesson(topic._id, li, 1)} disabled={li === lessons.length - 1} aria-label="Move down">
                              <FaArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button className="icon-btn" onClick={() => setLessonModal({ open: true, topicId: topic._id, lesson })} aria-label="Edit lesson">
                              <FaEdit className="w-3.5 h-3.5" />
                            </button>
                            <button className="icon-btn" onClick={() => deleteLesson(lesson)} aria-label="Delete lesson">
                              <FaTrash className="w-3.5 h-3.5" />
                            </button>
                            {lesson.status === 'completed' ? (
                              <button className="btn-secondary text-xs ml-2" onClick={() => setDetailLessonId(lesson._id)}>
                                <FaUndo className="w-3 h-3 mr-1" />
                                Reopen
                              </button>
                            ) : (
                              <button className="btn-primary text-xs ml-2" onClick={() => quickComplete(lesson)}>
                                <FaCheckCircle className="w-3 h-3 mr-1" />
                                Complete
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <TopicFormModal
        isOpen={topicModal.open}
        onClose={() => setTopicModal({ open: false, topic: null })}
        onSaved={load}
        assignmentId={assignmentId || ''}
        topic={topicModal.topic}
      />
      <LessonFormModal
        isOpen={lessonModal.open}
        onClose={() => setLessonModal({ open: false, topicId: '', lesson: null })}
        onSaved={load}
        assignmentId={assignmentId || ''}
        topicId={lessonModal.topicId}
        lesson={lessonModal.lesson}
      />
      <LessonDetailModal lessonId={detailLessonId} onClose={() => setDetailLessonId(null)} onChanged={load} />
    </div>
  );
}
