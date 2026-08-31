import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import {
  FaEdit,
  FaTrash,
  FaPlus,
  FaUserTie,
  FaUsers,
  FaLayerGroup,
  FaBookOpen,
  FaArrowLeft,
} from 'react-icons/fa';
import DataTable from '../../components/common/DataTable';
import type { Class, Student, Stream, Subject, Teacher, AcademicYear } from '../../types';
import { useAuth } from '../../context/AuthContext';

interface PopulatedClass extends Omit<Class, 'academicYear' | 'classTeacher' | 'streams' | 'subjects'> {
  academicYear: AcademicYear | string;
  classTeacher?: Teacher | string;
  streams: (Stream | string)[];
  subjects: (Subject | string)[];
}

interface StudentWithDetails extends Student {
  streamName?: string;
}

export default function ClassDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isHeadteacher } = useAuth();

  const [cls, setCls] = useState<PopulatedClass | null>(null);
  const [students, setStudents] = useState<StudentWithDetails[]>([]);
  const [allTeachers, setAllTeachers] = useState<Teacher[]>([]);
  const [streamTeachers, setStreamTeachers] = useState<Record<string, Teacher>>({});
  const [assigning, setAssigning] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'streams' | 'subjects' | 'students'>('students');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [classRes, studentsRes, teachersRes, assignmentsRes] = await Promise.all([
          api.get(`/classes/${id}`),
          api.get('/students', { params: { class: id, limit: 200 } }),
          api.get('/teachers', { params: { limit: 200 } }),
          api.get(`/classes/${id}/stream-assignments`),
        ]);
        setCls(classRes.data.data);
        setStudents(studentsRes.data.data?.students || studentsRes.data.data || []);
        setAllTeachers(teachersRes.data.data?.teachers || teachersRes.data.data || []);

        const map: Record<string, Teacher> = {};
        for (const a of assignmentsRes.data.data || []) {
          if (a.stream && typeof a.stream === 'object') {
            map[a.stream._id] = a.teacher;
          }
        }
        setStreamTeachers(map);
      } catch (err: any) {
        const message = err.response?.data?.message || 'Failed to load class details';
        setError(message);
        toast.error(message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const handleAssignStreamTeacher = async (streamId: string, teacherId: string) => {
    setAssigning((prev) => ({ ...prev, [streamId]: true }));
    try {
      await api.post(`/classes/${id}/streams/${streamId}/assign-teacher`, { teacherId });
      const teacher = allTeachers.find((t) => t._id === teacherId);
      setStreamTeachers((prev) => ({ ...prev, [streamId]: teacher as Teacher }));
      toast.success('Stream teacher assigned');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to assign teacher');
    } finally {
      setAssigning((prev) => ({ ...prev, [streamId]: false }));
    }
  };

  const handleRemoveStreamTeacher = async (streamId: string) => {
    if (!confirm('Remove the class teacher from this stream?')) return;
    setAssigning((prev) => ({ ...prev, [streamId]: true }));
    try {
      await api.delete(`/classes/${id}/streams/${streamId}/assign-teacher`);
      setStreamTeachers((prev) => {
        const copy = { ...prev };
        delete copy[streamId];
        return copy;
      });
      toast.success('Stream teacher removed');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to remove teacher');
    } finally {
      setAssigning((prev) => ({ ...prev, [streamId]: false }));
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this class?')) return;
    try {
      await api.delete(`/classes/${id}`);
      toast.success('Class deleted');
      navigate('/classes');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete class');
    }
  };

  const getTeacherName = (): string => {
    if (!cls?.classTeacher) return 'Not assigned';
    if (typeof cls.classTeacher === 'object') return (cls.classTeacher as Teacher).fullName;
    return 'Assigned';
  };

  const getAcademicYearName = (): string => {
    if (!cls?.academicYear) return '-';
    if (typeof cls.academicYear === 'object') return (cls.academicYear as AcademicYear).name;
    return cls.academicYear as string;
  };

  const getStreamName = (s: Stream | string): string => {
    if (typeof s === 'object') return (s as Stream).name;
    return s;
  };

  const getSubjectName = (s: Subject | string): Subject | null => {
    if (typeof s === 'object') return s as Subject;
    return null;
  };

  const resolvedStreams: Stream[] = (cls?.streams || []).map((s) => {
    if (typeof s === 'object') return s as Stream;
    return { _id: s, name: s, code: '', class: '' } as Stream;
  });

  const resolvedSubjects: Subject[] = (cls?.subjects || []).map((s) => {
    if (typeof s === 'object') return s as Subject;
    return { _id: s, name: s, code: '', category: 'core', credits: 0 } as Subject;
  });

  const studentColumns = [
    { key: 'admissionNumber', label: 'Adm No', sortable: true },
    {
      key: 'fullName',
      label: 'Name',
      render: (s: StudentWithDetails) => (
        <Link to={`/students/${s._id}`} className="text-primary-600 hover:underline font-medium">
          {s.fullName}
        </Link>
      ),
    },
    { key: 'gender', label: 'Gender', render: (s: StudentWithDetails) => <span className="capitalize">{s.gender}</span> },
    {
      key: 'stream',
      label: 'Stream',
      render: (s: StudentWithDetails) => {
        if (s.stream && typeof s.stream === 'object') return (s.stream as Stream).name;
        return s.streamName || '-';
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (s: StudentWithDetails) => (
        <span className={`badge ${s.status === 'active' ? 'badge-success' : 'badge-warning'}`}>{s.status}</span>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (error || !cls) {
    return (
      <div className="space-y-6">
        <button onClick={() => navigate('/classes')} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
          <FaArrowLeft className="w-4 h-4" />
          Back to Classes
        </button>
        <div className="card p-8 text-center">
          <p className="text-red-500 dark:text-red-400 mb-2">{error || 'Class not found'}</p>
          <button className="btn-secondary" onClick={() => navigate('/classes')}>Go to Classes</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/classes')} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
          <FaArrowLeft className="w-5 h-5" />
        </button>
        <div className="page-header flex-1 mb-0">
          <div>
            <h1 className="page-title">{cls.name}</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Code: {cls.code} &middot; {getAcademicYearName()}
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => navigate(`/classes/${id}/edit`)} className="btn-secondary">
              <FaEdit className="w-4 h-4 mr-1.5" />
              Edit
            </button>
            {isHeadteacher && (
              <button onClick={handleDelete} className="btn-danger">
                <FaTrash className="w-4 h-4 mr-1.5" />
                Delete
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
            <FaUserTie className="w-5 h-5" />
          </div>
          <p className="text-xl font-bold text-gray-900 dark:text-white mt-2">{getTeacherName()}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Class Teacher</p>
        </div>
        <div className="stat-card">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400">
            <FaUsers className="w-5 h-5" />
          </div>
          <p className="text-xl font-bold text-gray-900 dark:text-white mt-2">{students.length}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Students</p>
        </div>
        <div className="stat-card">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
            <FaLayerGroup className="w-5 h-5" />
          </div>
          <p className="text-xl font-bold text-gray-900 dark:text-white mt-2">{resolvedStreams.length}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Streams</p>
        </div>
        <div className="stat-card">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
            <FaBookOpen className="w-5 h-5" />
          </div>
          <p className="text-xl font-bold text-gray-900 dark:text-white mt-2">{resolvedSubjects.length}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Subjects</p>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
            {(['students', 'streams', 'subjects'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize ${
                  activeTab === tab
                    ? 'border-primary-600 text-primary-600 dark:text-primary-400 dark:border-primary-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {tab === 'students' && <FaUsers className="w-4 h-4 inline mr-1.5" />}
                {tab === 'streams' && <FaLayerGroup className="w-4 h-4 inline mr-1.5" />}
                {tab === 'subjects' && <FaBookOpen className="w-4 h-4 inline mr-1.5" />}
                {tab}
              </button>
            ))}
          </div>
          <Link to={`/students/new?class=${id}`} className="btn-secondary text-xs">
            <FaPlus className="w-3 h-3 mr-1" />
            Add Student
          </Link>
        </div>

        {activeTab === 'students' && (
          <DataTable
            columns={studentColumns}
            data={students}
            loading={false}
            searchable
            onView={(s) => navigate(`/students/${s._id}`)}
          />
        )}

        {activeTab === 'streams' && (
          <div>
            {resolvedStreams.length === 0 ? (
              <p className="text-center py-8 text-gray-400 dark:text-gray-500">No streams configured for this class.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {resolvedStreams.map((stream) => {
                  const count = students.filter((s) => {
                    if (s.stream && typeof s.stream === 'object') return (s.stream as Stream)._id === stream._id;
                    return false;
                  }).length;
                  const currentTeacher = streamTeachers[stream._id] as Teacher | undefined;
                  return (
                    <div key={stream._id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-sm transition-shadow">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-white">{stream.name}</h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Code: {stream.code}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-primary-600 dark:text-primary-400">{count}</p>
                          <p className="text-xs text-gray-500">Students</p>
                        </div>
                      </div>
                      <div className="border-t border-gray-100 dark:border-gray-700 pt-3 mt-1">
                        <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1.5">Class Teacher</label>
                        {isHeadteacher ? (
                          <div className="flex items-center gap-2">
                            <select
                              className="input-field text-sm flex-1"
                              value={currentTeacher?._id || ''}
                              disabled={assigning[stream._id]}
                              onChange={(e) => {
                                if (e.target.value) {
                                  handleAssignStreamTeacher(stream._id, e.target.value);
                                } else {
                                  handleRemoveStreamTeacher(stream._id);
                                }
                              }}
                            >
                              <option value="">-- Not assigned --</option>
                              {allTeachers.map((t) => (
                                <option key={t._id} value={t._id}>{t.fullName}</option>
                              ))}
                            </select>
                            {assigning[stream._id] && (
                              <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-primary-600 flex-shrink-0" />
                            )}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-900 dark:text-white">
                            {currentTeacher ? (currentTeacher as any).fullName : 'Not assigned'}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'subjects' && (
          <div>
            {resolvedSubjects.length === 0 ? (
              <p className="text-center py-8 text-gray-400 dark:text-gray-500">No subjects assigned to this class.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {resolvedSubjects.map((subject) => (
                  <div key={subject._id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-sm transition-shadow">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-gray-900 dark:text-white">{subject.name}</h4>
                      <span className={`badge text-xs ${subject.category === 'core' ? 'badge-success' : subject.category === 'elective' ? 'badge-warning' : 'badge-info'}`}>
                        {subject.category}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Code: {subject.code} | Credits: {subject.credits}
                    </p>
                    {subject.department && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{subject.department}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
