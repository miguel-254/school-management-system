import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import type { Teacher, Subject, Class as ClassType, TeacherDesignation, TeacherAssignment } from '../../types';
import { DESIGNATION_LABELS } from '../../types';
import { FaPlus, FaCrown } from 'react-icons/fa';
import toast from 'react-hot-toast';
import DataTable, { type Column } from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';

export default function TeacherList() {
  const navigate = useNavigate();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [allSubjects, setAllSubjects] = useState<Subject[]>([]);
  const [allClasses, setAllClasses] = useState<ClassType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filterSubject, setFilterSubject] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [viewTeacher, setViewTeacher] = useState<Teacher | null>(null);
  const [viewAssignments, setViewAssignments] = useState<TeacherAssignment[] | null>(null);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Teacher | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [teachersRes, subjectsRes, classesRes] = await Promise.all([
        api.get('/teachers', { params: filterStatus ? { isActive: filterStatus === 'active' } : {} }),
        api.get('/subjects'),
        api.get('/classes'),
      ]);
      setTeachers(teachersRes.data.data?.teachers || []);
      setAllSubjects(subjectsRes.data.data || []);
      setAllClasses(classesRes.data.data || []);
    } catch {
      setError(true);
      toast.error('Failed to load teachers');
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredTeachers = teachers.filter((t) => {
    if (filterSubject && !t.subjects.includes(filterSubject)) return false;
    if (filterStatus === 'active' && !t.isActive) return false;
    if (filterStatus === 'inactive' && t.isActive) return false;
    return true;
  });

  const subjectMap = Object.fromEntries(
    allSubjects.map((s) => [s._id, s.name])
  );

  const classMap = Object.fromEntries(
    allClasses.map((c) => [c._id, c.name])
  );

  const getClassName = (teacher: Teacher) => {
    if (!teacher.classAssigned) return '-';
    const classObj = teacher.classAssigned;
    if (typeof classObj === 'object' && classObj && (classObj as ClassType).name) return (classObj as ClassType).name;
    return classMap[teacher.classAssigned as string] || '-';
  };

  const columns: Column<Teacher>[] = [
    {
      key: 'employeeId',
      label: 'Employee ID',
    },
    {
      key: 'fullName',
      label: 'Full Name',
    },
    {
      key: 'designation',
      label: 'Designation',
      render: (teacher) => {
        const d = teacher.designation as TeacherDesignation;
        const label = d ? DESIGNATION_LABELS[d] || d : 'Teacher';
        const isHead = d === 'head_of_academics';
        const isHoD = d === 'head_of_department';
        const isSenior = d === 'senior_teacher';
        return (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
            isHead ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
            isHoD ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
            isSenior ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
            'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
          }`}>
            {(isHead || isHoD) && <FaCrown className="w-3 h-3" />}
            {label}
          </span>
        );
      },
    },
    {
      key: 'user.email',
      label: 'Email',
      render: (teacher) => {
        const u = teacher.user as any;
        return u?.email || '-';
      },
    },
    {
      key: 'user.phone',
      label: 'Phone',
      render: (teacher) => {
        const u = teacher.user as any;
        return u?.phone || '-';
      },
    },
    {
      key: 'subjects',
      label: 'Subjects',
      render: (teacher) => (
        <div className="flex flex-wrap gap-1">
          {teacher.subjects?.slice(0, 3).map((s: any) => {
            const id = typeof s === 'string' ? s : s._id;
            const name = typeof s === 'string' ? (subjectMap[s] || s) : s.name;
            return <span key={id} className="badge badge-info text-xs">{name}</span>;
          })}
          {(teacher.subjects?.length ?? 0) > 3 && (
            <span className="badge badge-info text-xs">
              +{teacher.subjects.length - 3}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'classAssigned',
      label: 'Classes',
      render: (teacher) => (
        <span className="text-gray-700 dark:text-gray-300">
          {getClassName(teacher)}
        </span>
      ),
    },
    {
      key: 'isActive',
      label: 'Status',
      render: (teacher) => (
        <span
          className={`badge ${
            teacher.isActive ? 'badge-success' : 'badge-danger'
          }`}
        >
          {teacher.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
    },
  ];

  const handleView = async (teacher: Teacher) => {
    setViewTeacher(teacher);
    setViewAssignments(null);
    setLoadingAssignments(true);
    try {
      const res = await api.get(`/teachers/${teacher._id}/assignments`);
      setViewAssignments(res.data.data || []);
    } catch {
      setViewAssignments([]);
    } finally {
      setLoadingAssignments(false);
    }
  };

  const handleCloseView = () => {
    setViewTeacher(null);
    setViewAssignments(null);
  };

  const handleEdit = (teacher: Teacher) => {
    navigate(`/teachers/new?id=${teacher._id}`);
  };

  const handleDelete = (teacher: Teacher) => {
    setDeleteTarget(teacher);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/teachers/${deleteTarget._id}`);
      toast.success('Teacher deleted');
      setDeleteTarget(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete teacher');
    } finally {
      setDeleting(false);
    }
  };

  if (error) {
    return (
      <div className="space-y-6">
        <div className="page-header">
          <h1 className="page-title">Teachers</h1>
          <button className="btn-primary" onClick={() => navigate('/teachers/new')}>
            <FaPlus className="w-4 h-4 mr-1" />
            Add Teacher
          </button>
        </div>
        <div className="card flex flex-col items-center justify-center py-16">
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Failed to load teachers. Please try again.
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
        <h1 className="page-title">Teachers</h1>
        <button className="btn-primary" onClick={() => navigate('/teachers/new')}>
          <FaPlus className="w-4 h-4 mr-1" />
          Add Teacher
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div>
          <label className="label text-xs mb-1">Filter by Subject</label>
          <select
            className="input-field"
            value={filterSubject}
            onChange={(e) => setFilterSubject(e.target.value)}
          >
            <option value="">All Subjects</option>
            {allSubjects.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label text-xs mb-1">Filter by Status</label>
          <select
            className="input-field"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      <DataTable<Teacher>
        columns={columns}
        data={filteredTeachers}
        loading={loading}
        onView={handleView}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <Modal
        isOpen={!!viewTeacher}
        onClose={handleCloseView}
        title="Teacher Details"
        size="lg"
      >
        {viewTeacher && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label text-xs text-gray-500">Employee ID</label>
                <p className="text-gray-900 dark:text-white font-medium">
                  {viewTeacher.employeeId}
                </p>
              </div>
              <div>
                <label className="label text-xs text-gray-500">Full Name</label>
                <p className="text-gray-900 dark:text-white font-medium">
                  {viewTeacher.fullName}
                </p>
              </div>
              <div>
                <label className="label text-xs text-gray-500">Designation</label>
                <p className="text-gray-900 dark:text-white font-medium">
                  {viewTeacher.designation ? DESIGNATION_LABELS[viewTeacher.designation as TeacherDesignation] || viewTeacher.designation : 'Teacher'}
                </p>
              </div>
              <div>
                <label className="label text-xs text-gray-500">Email</label>
                <p className="text-gray-700 dark:text-gray-300">
                  {viewTeacher.user && typeof viewTeacher.user === 'object' ? (viewTeacher.user as any).email : viewTeacher.email || '-'}
                </p>
              </div>
              <div>
                <label className="label text-xs text-gray-500">Phone</label>
                <p className="text-gray-700 dark:text-gray-300">
                  {viewTeacher.user && typeof viewTeacher.user === 'object' ? (viewTeacher.user as any).phone || '-' : viewTeacher.phone || '-'}
                </p>
              </div>
              <div>
                <label className="label text-xs text-gray-500">Date of Employment</label>
                <p className="text-gray-700 dark:text-gray-300">
                  {viewTeacher.dateOfEmployment
                    ? new Date(viewTeacher.dateOfEmployment).toLocaleDateString()
                    : '-'}
                </p>
              </div>
              <div>
                <label className="label text-xs text-gray-500">Status</label>
                <span
                  className={`badge ${
                    viewTeacher.isActive ? 'badge-success' : 'badge-danger'
                  }`}
                >
                  {viewTeacher.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>

            <div>
              <label className="label text-xs text-gray-500">Subjects</label>
              <div className="flex flex-wrap gap-1 mt-1">
                {viewTeacher.subjects?.length ? (
                  viewTeacher.subjects.map((s: any) => {
                    const id = typeof s === 'string' ? s : s._id;
                    const name = typeof s === 'string' ? (subjectMap[s] || s) : s.name;
                    return <span key={id} className="badge badge-info">{name}</span>;
                  })
                ) : (
                  <span className="text-gray-400">None assigned</span>
                )}
              </div>
            </div>

            <div>
              <label className="label text-xs text-gray-500">Assigned Class</label>
              <p className="text-gray-700 dark:text-gray-300">
                {getClassName(viewTeacher)}
              </p>
            </div>

            <div>
              <label className="label text-xs text-gray-500">
                Teaching Assignments ({viewAssignments?.length ?? 0})
              </label>
              {loadingAssignments ? (
                <div className="mt-2 space-y-2">
                  <div className="h-10 bg-gray-100 dark:bg-gray-700/50 rounded-lg animate-pulse" />
                  <div className="h-10 bg-gray-100 dark:bg-gray-700/50 rounded-lg animate-pulse" />
                </div>
              ) : (viewAssignments?.length ? (
                <div className="mt-2 space-y-2">
                  {viewAssignments.map((a) => {
                    const cls = a.class as any;
                    const subj = a.subject as any;
                    const stream = a.stream as any;
                    const year = a.academicYear as any;
                    const term = a.term as any;
                    return (
                      <div
                        key={a._id}
                        className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700"
                      >
                        <span className="badge badge-info">
                          {subj && typeof subj === 'object' ? subj.name : 'Class Teacher'}
                        </span>
                        <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                          {cls && typeof cls === 'object' ? cls.name : '-'}
                        </span>
                        {stream && typeof stream === 'object' ? (
                          <span className="badge badge-warning">{stream.name}</span>
                        ) : (
                          <span className="badge badge-success">All streams</span>
                        )}
                        {(year || term) && typeof year === 'object' && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {[typeof term === 'object' ? term.name : '', year?.name || year?.year || '']
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-gray-400 mt-1">No assignments found</p>
              ))}
            </div>

            <div>
              <label className="label text-xs text-gray-500">Qualifications</label>
              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {viewTeacher.qualifications || 'Not provided'}
              </p>
            </div>

            <div>
              <label className="label text-xs text-gray-500">Address</label>
              <p className="text-gray-700 dark:text-gray-300">
                {viewTeacher.address || 'Not provided'}
              </p>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Confirm Delete"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-600 dark:text-gray-400">
            Are you sure you want to delete{' '}
            <span className="font-semibold text-gray-900 dark:text-white">
              {deleteTarget?.fullName}
            </span>
            ? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <button
              className="btn-secondary"
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </button>
            <button
              className="btn-danger"
              disabled={deleting}
              onClick={confirmDelete}
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
