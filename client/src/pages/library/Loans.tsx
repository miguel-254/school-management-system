import { useState, useEffect, useCallback } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { FaPlus, FaUndo, FaExclamationTriangle } from 'react-icons/fa';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import LoanForm from './LoanForm';
import type { LibraryLoan } from '../../types';

function getBookTitle(loan: LibraryLoan): string {
  const b = loan.book;
  return typeof b === 'object' && b ? b.title : '';
}

export default function Loans() {
  const [loans, setLoans] = useState<LibraryLoan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showIssue, setShowIssue] = useState(false);
  const [returningId, setReturningId] = useState<string | null>(null);

  const fetchLoans = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      if (search) params.search = search;
      const { data } = await api.get('/library/loans', { params });
      setLoans(data.data || []);
    } catch (err: any) {
      const message = err.response?.data?.message || 'Failed to load loans';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    fetchLoans();
  }, [fetchLoans]);

  useEffect(() => {
    const timer = setTimeout(() => fetchLoans(), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleReturn = async (loan: LibraryLoan) => {
    if (!confirm(`Return "${getBookTitle(loan)}" borrowed by ${loan.borrowerName || 'Unknown'}?`)) return;
    setReturningId(loan._id);
    try {
      const { data } = await api.post(`/library/loans/${loan._id}/return`, { calculateFine: true });
      if (data.data?.fineAmount > 0) {
        toast.success(`Book returned. Fine: KSh ${data.data.fineAmount}`);
      } else {
        toast.success('Book returned');
      }
      fetchLoans();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to return book');
    } finally {
      setReturningId(null);
    }
  };

  const columns = [
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
        <div>
          <p className="text-gray-900 dark:text-white">{loan.borrowerName || 'Unknown'}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {loan.borrowerType}
            {loan.borrowerId ? ` · ${loan.borrowerId}` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'issueDate',
      label: 'Issued',
      render: (loan: LibraryLoan) => (
        <span className="text-gray-600 dark:text-gray-400">
          {new Date(loan.issueDate).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'dueDate',
      label: 'Due Date',
      render: (loan: LibraryLoan) => {
        const overdue = loan.status === 'issued' && new Date(loan.dueDate) < new Date();
        return (
          <span className={overdue ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-600 dark:text-gray-400'}>
            {new Date(loan.dueDate).toLocaleDateString()}
            {overdue && <span className="badge badge-danger ml-2">Overdue</span>}
          </span>
        );
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (loan: LibraryLoan) => (
        <span className={`badge ${loan.status === 'returned' ? 'badge-success' : 'badge-warning'}`}>
          {loan.status}
        </span>
      ),
    },
    {
      key: 'fineAmount',
      label: 'Fine',
      render: (loan: LibraryLoan) =>
        loan.fineAmount > 0 ? (
          <span className="text-red-600 dark:text-red-400 font-medium">KSh {loan.fineAmount}</span>
        ) : (
          <span className="text-gray-400">-</span>
        ),
    },
    {
      key: 'action',
      label: 'Action',
      render: (loan: LibraryLoan) =>
        loan.status === 'returned' ? (
          <span className="text-gray-400 text-xs">{loan.returnDate ? `Returned ${new Date(loan.returnDate).toLocaleDateString()}` : 'Returned'}</span>
        ) : (
          <button
            className="btn-secondary py-1.5 px-3 text-xs"
            disabled={returningId === loan._id}
            onClick={() => handleReturn(loan)}
          >
            {returningId === loan._id ? 'Returning...' : 'Return'}
          </button>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">Library Loans</h1>
        <div className="flex items-center gap-2">
          <button className="btn-primary" onClick={() => setShowIssue(true)}>
            <FaPlus className="w-4 h-4 mr-1.5" />
            Issue Book
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <FaUndo className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 hidden" />
          <input
            type="text"
            placeholder="Search by borrower name or ID..."
            className="input-field pl-3"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input-field w-full sm:w-44"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Loans</option>
          <option value="issued">Issued</option>
          <option value="returned">Returned</option>
          <option value="overdue">Overdue</option>
        </select>
      </div>

      {error && !loading ? (
        <div className="card p-8 text-center">
          <p className="text-red-500 dark:text-red-400 mb-2">{error}</p>
          <button className="btn-secondary" onClick={fetchLoans}>
            Retry
          </button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={loans}
          loading={loading}
        />
      )}

      {loans.some((l) => l.status === 'issued' && new Date(l.dueDate) < new Date()) && (
        <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
          <FaExclamationTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-300">
            There are overdue loans. Use the "Overdue" filter to review them.
          </p>
        </div>
      )}

      <Modal isOpen={showIssue} onClose={() => setShowIssue(false)} title="Issue Book" size="lg">
        <LoanForm
          onSuccess={() => {
            setShowIssue(false);
            fetchLoans();
          }}
          onCancel={() => setShowIssue(false)}
        />
      </Modal>
    </div>
  );
}