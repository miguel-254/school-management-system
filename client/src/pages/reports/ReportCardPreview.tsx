import { useState, useEffect } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import {
  FaPrint, FaSave, FaSpinner, FaSchool, FaUserGraduate, FaCalendarAlt,
  FaChartBar, FaQrcode, FaStamp, FaSignature, FaUserTie,
} from 'react-icons/fa';
import { BarChart } from '../../components/charts/Charts';
import type { ReportCard, SchoolSettings } from '../../types';

interface ReportCardPreviewProps {
  reportCard: ReportCard;
  onClose: () => void;
}

function getStudentValue(card: ReportCard, field: string): string {
  if (typeof card.student === 'object' && card.student) {
    const s = card.student as any;
    if (field === 'fullName') return s.fullName || `${s.firstName || ''} ${s.lastName || ''}`.trim() || 'Unknown';
    if (field === 'admissionNumber') return s.admissionNumber || '-';
    if (field === 'photo') return s.passportPhoto || s.photo || '';
    return s[field] || '-';
  }
  return card.student?.toString() || '-';
}

function getClassName(card: ReportCard): string {
  if (typeof card.class === 'object' && card.class) return (card.class as any).name || '';
  return card.class?.toString() || '-';
}

function getStreamName(card: ReportCard): string {
  if (typeof card.stream === 'object' && card.stream) return (card.stream as any).name || '';
  return card.stream?.toString() || '-';
}

function getSubjectName(subject: any): string {
  if (typeof subject === 'object' && subject) return subject.name || '-';
  return subject?.toString() || '-';
}

export default function ReportCardPreview({ reportCard, onClose }: ReportCardPreviewProps) {
  const [loading, setLoading] = useState(true);
  const [fullCard, setFullCard] = useState<ReportCard | null>(null);
  const [schoolSettings, setSchoolSettings] = useState<SchoolSettings | null>(null);
  const [teacherRemarks, setTeacherRemarks] = useState('');
  const [headteacherRemarks, setHeadteacherRemarks] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchFullData = async () => {
      setLoading(true);
      try {
        const [cardRes, settingsRes] = await Promise.all([
          api.get(`/report-cards/${reportCard._id}`),
          api.get('/settings/school').catch(() => null),
        ]);
        const card = cardRes.data.data || cardRes.data;
        setFullCard(card);
        setTeacherRemarks(card.teacherRemarks || '');
        setHeadteacherRemarks(card.headteacherRemarks || '');
        if (settingsRes?.data?.data) {
          setSchoolSettings(settingsRes.data.data);
        }
      } catch {
        setFullCard(reportCard);
      } finally {
        setLoading(false);
      }
    };
    fetchFullData();
  }, [reportCard]);

  const card = fullCard || reportCard;
  const config = schoolSettings?.reportCardConfig || { showLogo: true, showPhoto: true, showQR: true, showSignature: true, showStamp: true, showGraph: true };
  const subjects = card.subjects || [];

  const handleSaveRemarks = async () => {
    setSaving(true);
    try {
      await api.put(`/report-cards/${card._id}`, {
        teacherRemarks,
        headteacherRemarks,
      });
      toast.success('Remarks saved');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save remarks');
    } finally {
      setSaving(false);
    }
  };

  const chartData = config.showGraph && subjects.length > 0 ? {
    labels: subjects.map((s) => getSubjectName(s.subject)),
    datasets: [{
      label: 'Score',
      data: subjects.map((s) => s.score),
      backgroundColor: subjects.map((_, i) => {
        const colors = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16'];
        return colors[i % colors.length];
      }),
      borderRadius: 4,
    }],
  } : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <FaSpinner className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400 text-sm">Loading report card...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="report-card-container max-w-4xl mx-auto">
      <div id="report-card" className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8 print-card">
        <style>{`
          @media print {
            @page { margin: 0.5in; size: A4 portrait; }
            body * { visibility: hidden; }
            #report-card, #report-card * { visibility: visible; }
            #report-card { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 0.5in; box-shadow: none; border: none; }
            .no-print { display: none !important; }
            .print-break-inside { break-inside: avoid; }
          }
        `}</style>

        {config.showLogo && (
          <div className="flex justify-center mb-4 print-break-inside">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white shadow-md">
              <FaSchool className="w-10 h-10" />
            </div>
          </div>
        )}

        <div className="text-center mb-6 print-break-inside">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {schoolSettings?.schoolName || 'School Name'}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {schoolSettings?.address || 'School Address'}
          </p>
          {schoolSettings?.motto && (
            <p className="text-xs italic text-gray-400 dark:text-gray-500 mt-1">
              "{schoolSettings.motto}"
            </p>
          )}
        </div>

        <div className="text-center mb-6 print-break-inside">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white uppercase tracking-wide border-b-2 border-blue-600 pb-2 inline-block">
            Academic Report Card
          </h2>
        </div>

        <div className="flex items-start gap-6 mb-6 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg print-break-inside">
          {config.showPhoto && (
            <div className="w-24 h-28 bg-gray-200 dark:bg-gray-600 rounded-lg flex items-center justify-center shrink-0 border-2 border-gray-300 dark:border-gray-500">
              {getStudentValue(card, 'photo') ? (
                <img src={getStudentValue(card, 'photo')} alt="Student" className="w-full h-full object-cover rounded-lg" />
              ) : (
                <FaUserGraduate className="w-10 h-10 text-gray-400" />
              )}
            </div>
          )}

          <div className="flex-1 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div>
              <span className="text-gray-500 dark:text-gray-400 text-xs">Student Name</span>
              <p className="font-semibold text-gray-900 dark:text-white">{getStudentValue(card, 'fullName')}</p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400 text-xs">Admission No</span>
              <p className="font-semibold text-gray-900 dark:text-white">{getStudentValue(card, 'admissionNumber')}</p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400 text-xs">Class</span>
              <p className="font-semibold text-gray-900 dark:text-white">{getClassName(card)}</p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400 text-xs">Stream</span>
              <p className="font-semibold text-gray-900 dark:text-white">{getStreamName(card) || '-'}</p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400 text-xs">Term</span>
              <p className="font-semibold text-gray-900 dark:text-white">
                {typeof card.term === 'object' && card.term ? (card.term as any).name || '' : card.term || '-'}
              </p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400 text-xs">Academic Year</span>
              <p className="font-semibold text-gray-900 dark:text-white">
                {typeof card.academicYear === 'object' && card.academicYear ? (card.academicYear as any).name || '' : card.academicYear || '-'}
              </p>
            </div>
          </div>
        </div>

        <div className="mb-6 print-break-inside">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">Subjects Performance</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100 dark:bg-gray-700">
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">Subject</th>
                  <th className="text-center px-3 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">Score</th>
                  <th className="text-center px-3 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">Grade</th>
                  <th className="text-center px-3 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">G.P</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">Remarks</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">Teacher's Comment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {subjects.map((s, i) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">{getSubjectName(s.subject)}</td>
                    <td className="px-3 py-2 text-center">{s.score ?? '-'}</td>
                    <td className="px-3 py-2 text-center">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-bold">
                        {s.grade || '-'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">{s.gradePoint ?? '-'}</td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{s.remarks || '-'}</td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400 max-w-[150px] truncate">{s.teacherComments || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 print-break-inside">
          <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">Performance Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Total Score</span>
                <span className="font-semibold text-gray-900 dark:text-white">{card.totalScore?.toFixed(1) ?? '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Average Score</span>
                <span className="font-semibold text-gray-900 dark:text-white">{card.averageScore?.toFixed(1) ?? '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Grade</span>
                <span className="font-semibold text-blue-600 dark:text-blue-400">{card.grade || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Grade Point</span>
                <span className="font-semibold text-gray-900 dark:text-white">{card.gradePoint ?? '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Position</span>
                <span className="font-semibold text-gray-900 dark:text-white">{card.position ?? '-'} out of {card.classSize ?? '-'}</span>
              </div>
            </div>
          </div>

          <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">Attendance Summary</h3>
            {card.attendanceSummary ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Total Days</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{card.attendanceSummary.totalDays}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Present</span>
                  <span className="font-semibold text-green-600 dark:text-green-400">{card.attendanceSummary.present}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Absent</span>
                  <span className="font-semibold text-red-600 dark:text-red-400">{card.attendanceSummary.absent}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Excused</span>
                  <span className="font-semibold text-yellow-600 dark:text-yellow-400">{card.attendanceSummary.excused}</span>
                </div>
                <div className="flex justify-between border-t border-gray-200 dark:border-gray-600 pt-2 mt-2">
                  <span className="text-gray-500 dark:text-gray-400">Attendance %</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{card.attendanceSummary.percentage?.toFixed(1)}%</span>
                </div>
              </div>
            ) : (
              <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-4">No attendance data</p>
            )}
          </div>
        </div>

        {config.showGraph && chartData && (
          <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg print-break-inside">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide flex items-center gap-2">
              <FaChartBar className="w-4 h-4" />
              Performance Graph
            </h3>
            <BarChart data={chartData as any} height={200} />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 print-break-inside">
          <div>
            <label className="label">Class Teacher's Remarks</label>
            <textarea
              className="input-field w-full h-24 resize-none mt-1"
              placeholder="Enter teacher's remarks..."
              value={teacherRemarks}
              onChange={(e) => setTeacherRemarks(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Headteacher's Remarks</label>
            <textarea
              className="input-field w-full h-24 resize-none mt-1"
              placeholder="Enter headteacher's remarks..."
              value={headteacherRemarks}
              onChange={(e) => setHeadteacherRemarks(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-end justify-between mb-6 print-break-inside">
          <div className="flex-1">
            {config.showSignature && (
              <div className="space-y-6">
                <div>
                  <div className="w-40 border-b-2 border-gray-400 dark:border-gray-500 mb-1" />
                  <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                    <FaSignature className="w-3 h-3" />
                    Class Teacher's Signature
                  </p>
                </div>
                <div>
                  <div className="w-40 border-b-2 border-gray-400 dark:border-gray-500 mb-1" />
                  <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                    <FaUserTie className="w-3 h-3" />
                    Headteacher's Signature
                  </p>
                </div>
                <div>
                  <div className="w-40 border-b-2 border-gray-400 dark:border-gray-500 mb-1" />
                  <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                    <FaCalendarAlt className="w-3 h-3" />
                    Date
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col items-center gap-2">
            {config.showStamp && (
              <div className="w-20 h-20 rounded-full border-2 border-dashed border-red-400 dark:border-red-500 flex items-center justify-center bg-red-50 dark:bg-red-900/20">
                <FaStamp className="w-8 h-8 text-red-400 dark:text-red-500" />
              </div>
            )}
            {config.showQR && (
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center border border-gray-300 dark:border-gray-600">
                <FaQrcode className="w-8 h-8 text-gray-400" />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 mt-4 no-print">
        <button
          onClick={handleSaveRemarks}
          disabled={saving}
          className="btn-primary inline-flex items-center gap-2"
        >
          {saving ? (
            <FaSpinner className="w-4 h-4 animate-spin" />
          ) : (
            <FaSave className="w-4 h-4" />
          )}
          Save Remarks
        </button>
        <button
          onClick={() => window.print()}
          className="btn-secondary inline-flex items-center gap-2"
        >
          <FaPrint className="w-4 h-4" />
          Print
        </button>
      </div>
    </div>
  );
}
