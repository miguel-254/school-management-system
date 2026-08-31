import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import Modal from '../../components/common/Modal';
import type { Student, ApiResponse } from '../../types';
import { FaArrowLeft, FaEdit, FaTrash, FaPrint, FaExclamationTriangle, FaRedo, FaUserGraduate, FaMoneyBillWave } from 'react-icons/fa';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';

const statusBadgeClass: Record<string, string> = {
  active: 'badge-success',
  graduated: 'badge-info',
  transferred: 'badge-warning',
  archived: 'badge-danger',
};

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-8 w-64 bg-gray-200 dark:bg-gray-700 rounded-lg" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded-xl" />
          <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded-xl" />
        </div>
        <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded-xl" />
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="card flex flex-col items-center justify-center py-16 gap-4">
      <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
        <FaExclamationTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
      </div>
      <p className="text-lg font-medium text-gray-900 dark:text-white">Failed to load student</p>
      <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-md">{message}</p>
      <button onClick={onRetry} className="btn-primary flex items-center gap-2">
        <FaRedo className="w-4 h-4" />
        Try Again
      </button>
    </div>
  );
}

export default function StudentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const { isHeadteacher, isClassTeacher, isAcademicTeacher } = useAuth();
  const canEdit = isHeadteacher || isClassTeacher || isAcademicTeacher;

  const fetchStudent = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get<ApiResponse<{ student: Student }>>(`/students/${id}`);
      if (!data.data?.student) {
        setError('Student not found');
      } else {
        setStudent(data.data.student);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load student');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudent();
  }, [id]);

  const handleDelete = async () => {
    if (!student) return;
    try {
      await api.delete(`/students/${student._id}`);
      toast.success('Student deleted');
      navigate('/students');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete student');
    }
  };

  const calculateAge = (dob: string): number | null => {
    if (!dob) return null;
    const birth = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  };

  const formatDate = (dateStr?: string): string => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getValue = (val: unknown): string => {
    if (val == null) return '-';
    if (typeof val === 'object') return (val as any).name || '-';
    return String(val);
  };

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={fetchStudent} />;
  if (!student) {
    return (
      <div className="card flex items-center justify-center py-16 text-gray-500 dark:text-gray-400">
        Student not found
      </div>
    );
  }

  const age = calculateAge(student.dateOfBirth);

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/students')} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
            <FaArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="page-title">Student Profile</h1>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <button onClick={() => navigate(`/students/new?id=${student._id}`)} className="btn-secondary">
              <FaEdit className="w-4 h-4 mr-1" />
              Edit
            </button>
          )}
          <button className="btn-secondary" onClick={() => navigate('/report-cards')}>
            <FaPrint className="w-4 h-4 mr-1" />
            Print Report Card
          </button>
          {isHeadteacher && (
            <button onClick={() => setDeleteOpen(true)} className="btn-danger">
              <FaTrash className="w-4 h-4 mr-1" />
              Delete
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
          <div className="w-28 h-28 rounded-2xl overflow-hidden border-2 border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0">
            {student.passportPhoto ? (
              <img src={student.passportPhoto} alt={student.fullName} className="w-full h-full object-cover" />
            ) : (
              <FaUserGraduate className="w-12 h-12 text-gray-400" />
            )}
          </div>
          <div className="flex-1 text-center sm:text-left">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{student.fullName}</h2>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Admission No: <strong className="text-gray-700 dark:text-gray-200">{student.admissionNumber}</strong>
              </span>
              <span className={`badge ${statusBadgeClass[student.status] || 'badge-info'}`}>{student.status}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Personal Information</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <InfoItem label="Gender" value={student.gender ? student.gender.charAt(0).toUpperCase() + student.gender.slice(1) : '-'} />
              <InfoItem label="Date of Birth" value={formatDate(student.dateOfBirth)} />
              <InfoItem label="Age" value={age !== null ? `${age} years` : '-'} />
              <InfoItem label="Address" value={student.address || '-'} />
              <InfoItem label="Emergency Contact" value={student.emergencyContact || '-'} />
              <InfoItem label="Medical Info" value={student.medicalInfo || '-'} />
            </div>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Academic Information</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <InfoItem label="Class" value={getValue(student.class)} />
              <InfoItem label="Stream" value={student.stream ? getValue(student.stream) : '-'} />
              <InfoItem label="Enrollment Date" value={formatDate(student.enrollmentDate)} />
              <InfoItem label="Status" value={<span className={`badge ${statusBadgeClass[student.status] || 'badge-info'}`}>{student.status}</span>} />
              <InfoItem label="Previous School" value={student.previousSchool || '-'} />
            </div>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Academic History</h3>
            {student.academicHistory && student.academicHistory.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-3 px-3 font-medium text-gray-500 dark:text-gray-400">Year</th>
                      <th className="text-left py-3 px-3 font-medium text-gray-500 dark:text-gray-400">Term</th>
                      <th className="text-left py-3 px-3 font-medium text-gray-500 dark:text-gray-400">Class</th>
                      <th className="text-right py-3 px-3 font-medium text-gray-500 dark:text-gray-400">Average</th>
                      <th className="text-right py-3 px-3 font-medium text-gray-500 dark:text-gray-400">Position</th>
                      <th className="text-right py-3 px-3 font-medium text-gray-500 dark:text-gray-400">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                    {student.academicHistory.map((h, i) => (
                      <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                        <td className="py-3 px-3 text-gray-900 dark:text-white">{h.year}</td>
                        <td className="py-3 px-3 text-gray-700 dark:text-gray-300 capitalize">{h.term}</td>
                        <td className="py-3 px-3 text-gray-700 dark:text-gray-300">{h.class}</td>
                        <td className="py-3 px-3 text-right">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            h.average >= 80 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                            h.average >= 60 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                            'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          }`}>
                            {h.average}%
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right text-gray-900 dark:text-white font-medium">{h.position}</td>
                        <td className="py-3 px-3 text-right capitalize text-gray-700 dark:text-gray-300">{h.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex items-center justify-center py-10 text-gray-400 dark:text-gray-500 text-sm">
                No academic history available
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">School Fees</h3>
            <div className="space-y-4">
              <InfoItem label="Total Fee" value={student.schoolFees?.totalFee ? `${student.schoolFees.totalFee.toLocaleString()}` : '-'} />
              <InfoItem label="Amount Paid" value={student.schoolFees?.amountPaid ? `${student.schoolFees.amountPaid.toLocaleString()}` : '-'} />
              <InfoItem
                label="Balance"
                value={
                  student.schoolFees ? (
                    (() => {
                      const balance = student.schoolFees.totalFee - student.schoolFees.amountPaid;
                      if (balance <= 0) return <span className="badge badge-success">Fully Paid</span>;
                      return <span className="badge badge-danger">{balance.toLocaleString()}</span>;
                    })()
                  ) : '-'
                }
              />
            </div>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Guardian Information</h3>
            <div className="space-y-4">
              <InfoItem label="Name" value={student.guardianInfo?.name || '-'} />
              <InfoItem label="Phone" value={student.guardianInfo?.phone || '-'} />
              <InfoItem label="Email" value={student.guardianInfo?.email || '-'} />
              <InfoItem label="Relationship" value={student.guardianInfo?.relationship ? student.guardianInfo.relationship.charAt(0).toUpperCase() + student.guardianInfo.relationship.slice(1) : '-'} />
              <InfoItem label="Address" value={student.guardianInfo?.address || '-'} />
            </div>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Attendance Summary</h3>
            <div className="flex flex-col items-center justify-center py-6 text-gray-400 dark:text-gray-500">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-3">
                <FaPrint className="w-6 h-6" />
              </div>
              <p className="text-sm">Attendance data will be available</p>
              <p className="text-xs mt-1">once the module is configured</p>
            </div>
          </div>
        </div>
      </div>

      <Modal isOpen={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete Student" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Are you sure you want to delete <strong className="text-gray-900 dark:text-white">{student.fullName}</strong>?
            This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <button onClick={() => setDeleteOpen(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleDelete} className="btn-danger">Delete</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-sm font-medium text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}
