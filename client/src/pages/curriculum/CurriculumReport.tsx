import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { FaTrophy, FaBook, FaArrowLeft } from 'react-icons/fa';
import type { CurriculumReportRow } from '../../types';

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full ${percent >= 100 ? 'bg-green-500' : 'bg-blue-500'}`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

export default function CurriculumReport() {
  const [rows, setRows] = useState<CurriculumReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/curriculum/report');
      setRows(data.data || []);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load curriculum progress report.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const filtered = rows.filter((r) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      r.teacherName.toLowerCase().includes(q) ||
      r.subjectName.toLowerCase().includes(q) ||
      r.className.toLowerCase().includes(q) ||
      (r.streamName || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="page-title">Curriculum Progress Report</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Teaching progress across assigned subjects.</p>
        </div>
        <Link to="/my-subjects" className="btn-secondary">
          <FaArrowLeft className="w-4 h-4 mr-1.5" />
          My Subjects
        </Link>
      </div>

      <div className="relative max-w-sm">
        <input
          className="input-field pl-10"
          placeholder="Search teacher, subject, class…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <FaTrophy className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
      </div>

      <div className="card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-400">Teacher</th>
              <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-400">Subject</th>
              <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-400">Class</th>
              <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-400">Stream</th>
              <th className="text-center py-3 px-4 font-medium text-gray-600 dark:text-gray-400">Topics</th>
              <th className="text-center py-3 px-4 font-medium text-gray-600 dark:text-gray-400">Lessons</th>
              <th className="text-center py-3 px-4 font-medium text-gray-600 dark:text-gray-400">Progress</th>
              <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-400">Current</th>
              <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-400">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="py-10 text-center text-gray-400">Loading…</td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-10 text-center">
                  <FaBook className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                  <p className="text-gray-500 dark:text-gray-400">No curriculum data yet.</p>
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.assignmentId} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">{r.teacherName}</td>
                  <td className="py-3 px-4 text-gray-700 dark:text-gray-300">{r.subjectName}</td>
                  <td className="py-3 px-4 text-gray-700 dark:text-gray-300">{r.className}</td>
                  <td className="py-3 px-4 text-gray-700 dark:text-gray-300">{r.streamName}</td>
                  <td className="py-3 px-4 text-center text-gray-700 dark:text-gray-300">{r.topicsCompleted}/{r.totalTopics}</td>
                  <td className="py-3 px-4 text-center text-gray-700 dark:text-gray-300">{r.lessonsCompleted}/{r.totalLessons}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-end gap-2">
                      <ProgressBar percent={r.overallPercent} />
                      <span className="text-sm font-semibold text-gray-900 dark:text-white w-10 text-right">{r.overallPercent}%</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-gray-600 dark:text-gray-400 max-w-[200px]">
                    {r.currentLesson ? (
                      <span className="block truncate" title={`${r.currentTopic} — ${r.currentLesson}`}>
                        {r.currentTopic} — {r.currentLesson}
                      </span>
                    ) : (
                      <span className="text-green-600 dark:text-green-400">All done</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`badge ${r.status === 'Completed' ? 'badge-success' : r.status === 'In Progress' ? 'badge-warning' : 'badge-info'}`}>
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
