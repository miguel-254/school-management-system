import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { FaBook, FaSchool, FaStream, FaCalendarAlt, FaChevronRight, FaTrophy, FaListAlt } from 'react-icons/fa';
import type { CurriculumAssignment } from '../../types';

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${percent >= 100 ? 'bg-green-500' : percent > 0 ? 'bg-blue-500' : 'bg-gray-400'}`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function MySubjects() {
  const [assignments, setAssignments] = useState<CurriculumAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAssignments = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/curriculum/subjects');
      setAssignments(data.data || []);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load subjects');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="page-title">My Subjects</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Subjects assigned to you — open one to plan lessons and track progress.
          </p>
        </div>
        <Link to="/curriculum-report" className="btn-secondary">
          <FaTrophy className="w-4 h-4 mr-1.5" />
          Progress Report
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6 animate-pulse">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-64 bg-gray-200 dark:bg-gray-700 rounded-xl" />
          ))}
        </div>
      ) : assignments.length === 0 ? (
        <div className="card p-12 text-center">
          <FaBook className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400 mb-1">No subjects assigned yet.</p>
          <p className="text-sm text-gray-400 dark:text-gray-500">
            The headteacher will assign subjects to you. Assigned subjects will appear here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
          {assignments.map((a) => (
            <Link
              key={a._id}
              to={`/curriculum/${a._id}`}
              className="card group hover:shadow-lg hover:border-primary-300 dark:hover:border-primary-700 transition-all duration-200 flex flex-col"
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 bg-primary-100 dark:bg-primary-900/40 rounded-xl flex items-center justify-center shrink-0">
                    <FaBook className="w-5 h-5 text-primary-600 dark:text-primary-300" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">{a.subject?.name}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{a.subject?.code}</p>
                  </div>
                </div>
                <FaChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-primary-500 group-hover:translate-x-1 transition-all shrink-0 mt-1.5" />
              </div>

              <div className="space-y-1 text-sm text-gray-600 dark:text-gray-300 mb-4">
                <p className="flex items-center gap-2">
                  <FaSchool className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  {a.class?.name} {a.stream?.name ? `• ${a.stream.name}` : '• All streams'}
                </p>
                <p className="flex items-center gap-2">
                  <FaCalendarAlt className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  {a.term?.name || 'Current'} • {a.academicYear?.name || '—'}
                </p>
              </div>

              <div className="space-y-2 mb-4 flex-1">
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>
                    {a.stats.completedTopics} of {a.stats.totalTopics} topics completed
                  </span>
                  <span>
                    {a.stats.completedLessons} of {a.stats.totalLessons} lessons
                  </span>
                </div>
                <ProgressBar percent={a.stats.overallPercent} />
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-semibold ${a.stats.overallPercent >= 100 ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'}`}>
                    {a.stats.overallPercent}% Complete
                  </span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    Updated {formatDate(a.stats.lastUpdated)}
                  </span>
                </div>
              </div>

              <div className="border-t border-gray-100 dark:border-gray-700 pt-3">
                {a.stats.currentLesson ? (
                  <div className="flex items-center gap-2 min-w-0">
                    <FaListAlt className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <p className="text-xs text-gray-600 dark:text-gray-300 truncate">
                      Next: <span className="font-medium">{a.stats.currentTopic?.title} — {a.stats.currentLesson.title}</span>
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-green-600 dark:text-green-400">All lessons completed for this subject</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
