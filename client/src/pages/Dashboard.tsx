import { useState, useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import toast from 'react-hot-toast';
import {
  FaUsers, FaChalkboardTeacher, FaSchool, FaCalendarCheck, FaChartLine, FaTrophy,
  FaCheckCircle, FaClock, FaExclamationTriangle, FaRedo, FaUserGraduate, FaBook,
  FaArrowUp, FaArrowDown, FaMinus, FaFileAlt, FaStar,
} from 'react-icons/fa';
import { LineChart, BarChart, DoughnutChart } from '../components/charts/Charts';
import StatsCard from '../components/common/StatsCard';
import type { ApiResponse } from '../types';

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded-lg" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 bg-gray-200 dark:bg-gray-700 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-80 bg-gray-200 dark:bg-gray-700 rounded-xl" />
        <div className="h-80 bg-gray-200 dark:bg-gray-700 rounded-xl" />
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-96 gap-4">
      <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
        <FaExclamationTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
      </div>
      <p className="text-lg font-medium text-gray-900 dark:text-white">Failed to load dashboard</p>
      <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-md">{message}</p>
      <button onClick={onRetry} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
        <FaRedo className="w-4 h-4" /> Try Again
      </button>
    </div>
  );
}

function ChangeIndicator({ value }: { value: number }) {
  if (value > 0) return <span className="text-green-600 dark:text-green-400 text-xs flex items-center gap-0.5"><FaArrowUp /> {value}%</span>;
  if (value < 0) return <span className="text-red-600 dark:text-red-400 text-xs flex items-center gap-0.5"><FaArrowDown /> {Math.abs(value)}%</span>;
  return <span className="text-gray-400 text-xs flex items-center gap-0.5"><FaMinus /> 0%</span>;
}

// ─── HEADTEACHER VIEW ───────────────────────────────────────────────
function HeadteacherView({ data }: { data: any }) {
  const o = data.overview || {};
  const perfByClass = data.performanceByClass || [];
  const attByClass = data.attendanceByClass || [];
  const perfDist = data.performanceDistribution || [];

  const perfChartData = {
    labels: perfByClass.map((p: any) => p.className || 'Unknown'),
    datasets: [{
      label: 'Avg Score',
      data: perfByClass.map((p: any) => p.averageScore),
      backgroundColor: 'rgba(59, 130, 246, 0.7)',
      borderColor: '#3b82f6',
      borderWidth: 1,
      borderRadius: 4,
    }],
  };

  const attChartData = {
    labels: attByClass.map((a: any) => a.className || 'Unknown'),
    datasets: [{
      label: 'Attendance %',
      data: attByClass.map((a: any) => a.percentage),
      backgroundColor: 'rgba(34, 197, 94, 0.7)',
      borderColor: '#22c55e',
      borderWidth: 1,
      borderRadius: 4,
    }],
  };

  const gradeChartData = perfDist.length > 0 ? {
    labels: perfDist.map((g: any) => g._id),
    datasets: [{
      label: 'Students',
      data: perfDist.map((g: any) => g.count),
      backgroundColor: ['#22c55e', '#3b82f6', '#eab308', '#f97316', '#ef4444', '#8b5cf6'],
      borderWidth: 2,
      borderColor: '#ffffff',
    }],
  } : null;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Headteacher Dashboard</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-0.5 text-xs sm:text-sm">School-wide overview — Read-only</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatsCard title="Total Students" value={o.totalStudents ?? 0} icon={<FaUsers className="w-5 h-5" />} color="blue" />
        <StatsCard title="Total Teachers" value={o.totalTeachers ?? 0} icon={<FaChalkboardTeacher className="w-5 h-5" />} color="green" />
        <StatsCard title="Classes" value={o.totalClasses ?? 0} icon={<FaSchool className="w-5 h-5" />} color="purple" />
        <StatsCard title="Attendance" value={`${o.attendancePercentage ?? 0}%`} icon={<FaCalendarCheck className="w-5 h-5" />} color="yellow" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="card overflow-hidden">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">Performance by Class</h3>
          {perfByClass.length > 0 ? <BarChart data={perfChartData as any} height={200} /> : <EmptyChart />}
        </div>
        <div className="card overflow-hidden">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">Attendance by Class</h3>
          {attByClass.length > 0 ? <BarChart data={attChartData as any} height={200} /> : <EmptyChart />}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="card overflow-hidden">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">Grade Distribution</h3>
          {gradeChartData ? <DoughnutChart data={gradeChartData as any} height={200} /> : <EmptyChart />}
        </div>
        <div className="card overflow-hidden">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">Recent Assessments</h3>
          {data.recentAssessments?.length > 0 ? (
            <div className="space-y-2 sm:space-y-3">
              {data.recentAssessments.map((a: any) => (
                <div key={a._id} className="flex items-center justify-between p-2 sm:p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{a.name || a._id}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{a.subject?.name || ''} - {a.class?.name || ''}</p>
                  </div>
                  <span className="text-xs text-gray-500 shrink-0">{new Date(a.createdAt).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          ) : <EmptyChart />}
        </div>
      </div>
    </div>
  );
}

// ─── CLASS TEACHER VIEW ─────────────────────────────────────────────
function ClassTeacherView({ data, subjectData }: { data: any; subjectData: any }) {
  const classesList = data.classesList || [];
  const subjects = subjectData?.subjectsPerformance || [];

  const weeklyData = data.weeklyAttendance || [];
  const chartData = weeklyData.length > 0 ? {
    labels: weeklyData.map((w: any) => {
      const d = new Date(w.date);
      return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }),
    datasets: [{
      label: 'Attendance %',
      data: weeklyData.map((w: any) => w.percentage),
      backgroundColor: 'rgba(34, 197, 94, 0.7)',
      borderColor: '#22c55e',
      borderWidth: 1,
      borderRadius: 4,
    }],
  } : null;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Class Teacher Dashboard</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-0.5 text-xs sm:text-sm">Attendance & class overview</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatsCard title="My Classes" value={data.totalClasses ?? 0} icon={<FaSchool className="w-5 h-5" />} color="blue" />
        <StatsCard title="Total Students" value={data.totalStudents ?? 0} icon={<FaUserGraduate className="w-5 h-5" />} color="green" />
        <StatsCard title="Today's Attendance" value={`${data.todayAttendance?.percentage ?? 0}%`} icon={<FaCalendarCheck className="w-5 h-5" />} color="yellow" />
        <StatsCard title="Present Today" value={data.todayAttendance?.present ?? 0} icon={<FaCheckCircle className="w-5 h-5" />} color="green" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="card overflow-hidden">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">Weekly Attendance Trend</h3>
          {chartData ? <BarChart data={chartData as any} height={200} /> : <EmptyChart />}
        </div>
        <div className="card overflow-hidden">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">My Subjects</h3>
          {subjects.length > 0 ? (
            <div className="space-y-2 sm:space-y-3">
              {subjects.map((s: any) => {
                const linkAssignment = (subjectData?.assignments || []).find(
                  (a: any) => a.subject?._id?.toString() === s.subjectId?.toString()
                );
                const row = (
                  <>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{s.subjectName}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">{s.currentAverage}</span>
                        <ChangeIndicator value={s.change} />
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {(s.classes && s.classes.length > 0) ? s.classes.join(', ') : 'No classes'}
                      {s.allStreams ? ' · All Streams' : (s.streams && s.streams.length > 0) ? ` · ${s.streams.join(', ')}` : ''}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      Previous: {s.previousAverage} | Students: {s.totalMarks}
                    </p>
                  </>
                );
                return linkAssignment ? (
                  <Link
                    key={s.subjectId}
                    to={`/curriculum/${linkAssignment._id}`}
                    className="block p-2 sm:p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700/70 transition-colors"
                  >
                    {row}
                  </Link>
                ) : (
                  <div key={s.subjectId} className="p-2 sm:p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    {row}
                  </div>
                );
              })}
            </div>
          ) : <EmptyChart />}
        </div>
      </div>

      <div className="card overflow-hidden">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">My Classes</h3>
        {classesList.length > 0 ? (
          <div className="space-y-2 sm:space-y-3">
            {classesList.map((cls: any) => (
              <Link key={cls._id} to={`/classes/${cls._id}`} className="flex items-center justify-between p-2 sm:p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700/70 transition-colors">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 bg-indigo-100 dark:bg-indigo-900/40 rounded-lg flex items-center justify-center shrink-0">
                    <FaSchool className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{cls.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{cls.studentCount} students</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {cls.streams && cls.streams.length > 0 ? cls.streams.join(', ') : 'All streams'}
                      {cls.subjects && cls.subjects.length > 0 ? ` · ${cls.subjects.join(', ')}` : ''}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center min-h-[120px] sm:min-h-[160px] text-gray-400 dark:text-gray-500 text-sm">
            No classes assigned
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SUBJECT TEACHER VIEW ───────────────────────────────────────────
function SubjectTeacherView({ data }: { data: any }) {
  const subjects = data.subjectsPerformance || [];
  const pendingAssessments = data.pendingAssessments || [];

  const subjectNames = subjects.map((s: any) => s.subjectName);
  const performanceChartData = subjects.length > 0 ? {
    labels: subjectNames,
    datasets: [
      {
        label: 'Current Term',
        data: subjects.map((s: any) => s.currentAverage),
        backgroundColor: 'rgba(59, 130, 246, 0.7)',
        borderColor: '#3b82f6',
        borderWidth: 1,
        borderRadius: 4,
      },
      {
        label: 'Previous Term',
        data: subjects.map((s: any) => s.previousAverage),
        backgroundColor: 'rgba(156, 163, 175, 0.5)',
        borderColor: '#9ca3af',
        borderWidth: 1,
        borderRadius: 4,
      },
    ],
  } : null;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Subject Teacher Dashboard</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-0.5 text-xs sm:text-sm">Subject performance & pending assessments</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatsCard title="My Subjects" value={data.totalSubjects ?? 0} icon={<FaBook className="w-5 h-5" />} color="blue" />
        <StatsCard title="Classes" value={data.totalClasses ?? 0} icon={<FaSchool className="w-5 h-5" />} color="green" />
        <StatsCard title="Marks Entered" value={data.totalMarksEntered ?? 0} icon={<FaStar className="w-5 h-5" />} color="yellow" />
        <StatsCard title="Pending" value={pendingAssessments.length} icon={<FaFileAlt className="w-5 h-5" />} color="red" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="card overflow-hidden">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">Subject Performance (Current vs Previous Term)</h3>
          {performanceChartData ? <BarChart data={performanceChartData as any} height={200} /> : <EmptyChart />}
        </div>
        <div className="card overflow-hidden">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">Subject Breakdown</h3>
          {subjects.length > 0 ? (
            <div className="space-y-2 sm:space-y-3">
              {subjects.map((s: any) => {
                const linkAssignment = (data.assignments || []).find(
                  (a: any) => a.subject?._id?.toString() === s.subjectId?.toString()
                );
                const row = (
                  <>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{s.subjectName}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">{s.currentAverage}</span>
                        <ChangeIndicator value={s.change} />
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {(s.classes && s.classes.length > 0) ? s.classes.join(', ') : 'No classes'}
                      {s.allStreams ? ' · All Streams' : (s.streams && s.streams.length > 0) ? ` · ${s.streams.join(', ')}` : ''}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      Previous: {s.previousAverage} | Students: {s.totalMarks}
                    </p>
                  </>
                );
                return linkAssignment ? (
                  <Link
                    key={s.subjectId}
                    to={`/curriculum/${linkAssignment._id}`}
                    className="block p-2 sm:p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700/70 transition-colors"
                  >
                    {row}
                  </Link>
                ) : (
                  <div key={s.subjectId} className="p-2 sm:p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    {row}
                  </div>
                );
              })}
            </div>
          ) : <EmptyChart />}
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Pending Released Assessments</h3>
        </div>
        {pendingAssessments.length > 0 ? (
          <div className="space-y-2 sm:space-y-3">
            {pendingAssessments.map((a: any) => (
              <div key={a._id} className="flex items-center justify-between p-2 sm:p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg gap-2">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 bg-blue-100 dark:bg-blue-900/40 rounded-lg flex items-center justify-center shrink-0">
                    <FaFileAlt className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{a.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{a.class?.name || ''}</p>
                  </div>
                </div>
                <Link to="/marks/enter" className="text-xs text-primary-600 hover:underline shrink-0">Enter Marks</Link>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center min-h-[80px] sm:min-h-[100px] text-gray-400 dark:text-gray-500 text-sm">
            No pending released assessments
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ACADEMIC TEACHER VIEW ──────────────────────────────────────────
function AcademicTeacherView({ data }: { data: any }) {
  const assessmentStats = data.assessmentStats || {};
  const perfByClass = data.performanceByClass || [];
  const marksByTeacher = data.marksByTeacher || [];
  const pendingForMarks = data.pendingForMarks || [];

  const perfChartData = perfByClass.length > 0 ? {
    labels: perfByClass.map((p: any) => p.className || 'Unknown'),
    datasets: [{
      label: 'Avg Score',
      data: perfByClass.map((p: any) => p.averageScore),
      backgroundColor: 'rgba(59, 130, 246, 0.7)',
      borderColor: '#3b82f6',
      borderWidth: 1,
      borderRadius: 4,
    }],
  } : null;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Academic Teacher Dashboard</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-0.5 text-xs sm:text-sm">Assessment management & compiled results</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatsCard title="Total" value={assessmentStats.total ?? 0} icon={<FaFileAlt className="w-5 h-5" />} color="blue" />
        <StatsCard title="Draft" value={assessmentStats.draft ?? 0} icon={<FaClock className="w-5 h-5" />} color="yellow" />
        <StatsCard title="Released" value={assessmentStats.released ?? 0} icon={<FaCheckCircle className="w-5 h-5" />} color="green" />
        <StatsCard title="Published" value={assessmentStats.published ?? 0} icon={<FaTrophy className="w-5 h-5" />} color="purple" />
      </div>

      {/* Performance by Class + Recent Marks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="card overflow-hidden">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">Performance by Class</h3>
          {perfChartData ? <BarChart data={perfChartData as any} height={200} /> : <EmptyChart />}
        </div>
        <div className="card overflow-hidden">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">Recent Marks Entered</h3>
          {data.allMarks?.length > 0 ? (
            <div className="space-y-2 max-h-[200px] sm:max-h-[300px] overflow-y-auto">
              {data.allMarks.slice(0, 10).map((m: any) => (
                <div key={m._id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded text-sm gap-2">
                  <span className="text-gray-900 dark:text-white font-medium truncate min-w-0">
                    {typeof m.student === 'object' ? m.student?.fullName || `${m.student?.firstName || ''} ${m.student?.lastName || ''}` : m.student}
                  </span>
                  <span className="text-gray-500 dark:text-gray-400 shrink-0 text-xs sm:text-sm">{m.score}/{m.totalScore}</span>
                </div>
              ))}
            </div>
          ) : <EmptyChart />}
        </div>
      </div>

      {/* Marks Reports by Teacher */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Marks Reports by Teacher</h3>
          <Link to="/marks" className="text-xs sm:text-sm text-primary-600 hover:underline shrink-0">View All Marks</Link>
        </div>
        {marksByTeacher.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 px-3 font-medium text-gray-600 dark:text-gray-400">Teacher</th>
                  <th className="text-center py-2 px-3 font-medium text-gray-600 dark:text-gray-400">Marks Entered</th>
                  <th className="text-center py-2 px-3 font-medium text-gray-600 dark:text-gray-400">Avg Score</th>
                  <th className="text-center py-2 px-3 font-medium text-gray-600 dark:text-gray-400">Assessments</th>
                  <th className="text-center py-2 px-3 font-medium text-gray-600 dark:text-gray-400">Subjects</th>
                </tr>
              </thead>
              <tbody>
                {marksByTeacher.map((t: any) => (
                  <tr key={t.teacherId} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-primary-100 dark:bg-primary-900/40 rounded-full flex items-center justify-center shrink-0">
                          <span className="text-xs font-medium text-primary-700 dark:text-primary-300">
                            {t.teacherName?.charAt(0) || '?'}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 dark:text-white truncate">{t.teacherName}</p>
                          {t.employeeId && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">{t.employeeId}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="text-center py-2.5 px-3">
                      <span className="font-semibold text-gray-900 dark:text-white">{t.totalMarks}</span>
                    </td>
                    <td className="text-center py-2.5 px-3">
                      <span className="font-semibold text-gray-900 dark:text-white">{t.averageScore}</span>
                    </td>
                    <td className="text-center py-2.5 px-3">
                      <span className="text-gray-600 dark:text-gray-300">{t.assessmentCount}</span>
                    </td>
                    <td className="text-center py-2.5 px-3">
                      <span className="text-gray-600 dark:text-gray-300">{t.subjectCount}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex items-center justify-center min-h-[120px] text-gray-400 dark:text-gray-500 text-sm">
            No marks have been entered yet
          </div>
        )}
      </div>

      {/* Pending Assessments (Released — Awaiting Marks) */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Released Assessments — Awaiting Marks</h3>
          <Link to="/assessments" className="text-xs sm:text-sm text-primary-600 hover:underline shrink-0">Manage All</Link>
        </div>
        {pendingForMarks.length > 0 ? (
          <div className="space-y-2 sm:space-y-3">
            {pendingForMarks.map((a: any) => (
              <div key={a._id} className="flex items-center justify-between p-2 sm:p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg gap-2">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 bg-yellow-100 dark:bg-yellow-900/40 rounded-lg flex items-center justify-center shrink-0">
                    <FaFileAlt className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-yellow-600 dark:text-yellow-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{a.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {a.subject?.name || ''} - {a.class?.name || ''}
                      {a.examDate ? ` | Exam: ${new Date(a.examDate).toLocaleDateString()}` : ''}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-blue-600 dark:text-blue-400 font-medium shrink-0">Released</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center min-h-[80px] text-gray-400 dark:text-gray-500 text-sm">
            No released assessments awaiting marks
          </div>
        )}
      </div>

      {/* Recent Assessments */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Recent Assessments</h3>
          <Link to="/assessments" className="text-xs sm:text-sm text-primary-600 hover:underline shrink-0">Manage All</Link>
        </div>
        {data.recentAssessments?.length > 0 ? (
          <div className="space-y-2 sm:space-y-3">
            {data.recentAssessments.map((a: any) => (
              <div key={a._id} className="flex items-center justify-between p-2 sm:p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{a.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{a.subject?.name || ''} - {a.class?.name || ''}</p>
                </div>
                <span className={`text-xs px-1.5 sm:px-2 py-0.5 rounded-full font-medium shrink-0 ${
                  a.status === 'published' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                  a.status === 'released' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                  a.status === 'draft' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                  'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
                }`}>{a.status}</span>
              </div>
            ))}
          </div>
        ) : <EmptyChart />}
      </div>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex items-center justify-center min-h-[120px] sm:min-h-[160px] text-gray-400 dark:text-gray-500 text-sm">
      No data available
    </div>
  );
}

// ─── MAIN DASHBOARD ─────────────────────────────────────────────────
export default function Dashboard() {
  const { isHeadteacher, isClassTeacher, isSubjectTeacher, isAcademicTeacher, isLibrarian, user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [subjectData, setSubjectData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  if (isLibrarian) {
    return <Navigate to="/library" replace />;
  }

  const resolvedRole =
    isHeadteacher ? 'headteacher' :
    isClassTeacher ? 'class_teacher' :
    isSubjectTeacher ? 'subject_teacher' :
    isAcademicTeacher ? 'academic_teacher' :
    (user?.role === 'teacher' ? 'subject_teacher' : null);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    setSubjectData(null);
    try {
      if (resolvedRole === 'headteacher') {
        const res = await api.get('/dashboard/headteacher');
        setData(res.data.data);
      } else if (resolvedRole === 'class_teacher') {
        const [classRes, subjectRes] = await Promise.all([
          api.get('/dashboard/class-teacher'),
          api.get('/dashboard/subject-teacher'),
        ]);
        setData(classRes.data.data);
        setSubjectData(subjectRes.data.data);
      } else if (resolvedRole === 'subject_teacher') {
        const res = await api.get('/dashboard/subject-teacher');
        setData(res.data.data);
      } else if (resolvedRole === 'academic_teacher') {
        const res = await api.get('/dashboard/academic-teacher');
        setData(res.data.data);
      } else {
        setLoading(false);
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to load dashboard data';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [resolvedRole]);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;
  if (!data) return <div className="flex items-center justify-center h-96 text-gray-500">No dashboard data available</div>;

  if (resolvedRole === 'headteacher') return <HeadteacherView data={data} />;
  if (resolvedRole === 'class_teacher') return <ClassTeacherView data={data} subjectData={subjectData} />;
  if (resolvedRole === 'subject_teacher') return <SubjectTeacherView data={data} />;
  if (resolvedRole === 'academic_teacher') return <AcademicTeacherView data={data} />;

  return <div className="flex items-center justify-center h-96 text-gray-500">Unknown role: {user?.role}</div>;
}