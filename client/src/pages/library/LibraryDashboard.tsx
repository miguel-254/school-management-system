import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { FaBook, FaBookOpen, FaClipboardCheck, FaExclamationTriangle, FaPlus, FaHistory } from 'react-icons/fa';
import StatsCard from '../../components/common/StatsCard';
import DataTable from '../../components/common/DataTable';
import type { LibraryStats, LibraryLoan } from '../../types';

function getBookTitle(loan: LibraryLoan): string {
  const b = loan.book;
  return typeof b === 'object' && b ? b.title : '';
}

export default function LibraryDashboard() {
  const [stats, setStats] = useState<LibraryStats | null>(null);
  const [recentLoans, setRecentLoans] = useState<LibraryLoan[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, loansRes] = await Promise.all([
        api.get('/library/stats'),
        api.get('/library/loans', { params: { status: 'issued', limit: 6 } }),
      ]);
      setStats(statsRes.data.data);
      setRecentLoans(loansRes.data.data || []);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load library stats');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 bg-gray-200 dark:bg-gray-700 rounded-xl" />
          ))}
        </div>
        <div className="h-80 bg-gray-200 dark:bg-gray-700 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">Library Dashboard</h1>
        <div className="flex items-center gap-2">
          <Link to="/library/books" className="btn-secondary">
            <FaBook className="w-4 h-4 mr-1.5" />
            Books
          </Link>
          <Link to="/library/loans" className="btn-primary">
            <FaPlus className="w-4 h-4 mr-1.5" />
            Issue Book
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Total Books" value={stats?.totalBooks ?? 0} icon={<FaBook className="w-5 h-5" />} color="blue" />
        <StatsCard title="Available Copies" value={stats?.availableCopies ?? 0} icon={<FaBookOpen className="w-5 h-5" />} color="green" />
        <StatsCard title="Active Loans" value={stats?.activeLoans ?? 0} icon={<FaClipboardCheck className="w-5 h-5" />} color="purple" />
        <StatsCard title="Overdue Loans" value={stats?.overdueLoans ?? 0} icon={<FaExclamationTriangle className="w-5 h-5" />} color="red" />
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <FaHistory className="w-4 h-4 text-gray-400" />
            Recently Issued
          </h2>
          <Link to="/library/loans" className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400">
            View all
          </Link>
        </div>
        <DataTable
          columns={[
            {
              key: 'book',
              label: 'Book',
              render: (loan: LibraryLoan) => (
                <span className="font-medium text-gray-900 dark:text-white">{getBookTitle(loan)}</span>
              ),
            },
            {
              key: 'borrowerName',
              label: 'Borrower',
              render: (loan: LibraryLoan) => (
                <span>
                  {loan.borrowerName || 'Unknown'}
                  {loan.borrowerId && <span className="text-xs text-gray-400 ml-1">({loan.borrowerId})</span>}
                </span>
              ),
            },
            {
              key: 'dueDate',
              label: 'Due Date',
              render: (loan: LibraryLoan) => {
                const overdue = new Date(loan.dueDate) < new Date();
                return (
                  <span className={overdue ? 'text-red-600 dark:text-red-400 font-medium' : ''}>
                    {new Date(loan.dueDate).toLocaleDateString()}
                    {overdue && <span className="badge badge-danger ml-2">Overdue</span>}
                  </span>
                );
              },
            },
          ]}
          data={recentLoans}
          loading={false}
          searchable={false}
        />
      </div>
    </div>
  );
}