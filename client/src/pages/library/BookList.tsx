import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { FaPlus, FaSearch, FaUndo } from 'react-icons/fa';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import BookForm from './BookForm';
import type { LibraryBook } from '../../types';

export default function BookList() {
  const navigate = useNavigate();
  const [books, setBooks] = useState<LibraryBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editBook, setEditBook] = useState<LibraryBook | null>(null);

  const fetchBooks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (categoryFilter) params.category = categoryFilter;
      if (statusFilter) params.status = statusFilter;
      const { data } = await api.get('/library/books', { params });
      setBooks(data.data || []);
    } catch (err: any) {
      const message = err.response?.data?.message || 'Failed to load books';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [search, categoryFilter, statusFilter]);

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  useEffect(() => {
    const timer = setTimeout(() => fetchBooks(), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleDelete = async (book: LibraryBook) => {
    if (!confirm(`Are you sure you want to delete "${book.title}"?`)) return;
    try {
      await api.delete(`/library/books/${book._id}`);
      toast.success('Book deleted');
      fetchBooks();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete book');
    }
  };

  const handleEdit = (book: LibraryBook) => {
    setEditBook(book);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditBook(null);
  };

  const handleFormSuccess = () => {
    handleFormClose();
    fetchBooks();
  };

  const columns = [
    {
      key: 'title',
      label: 'Title',
      sortable: true,
      render: (book: LibraryBook) => (
        <span className="font-medium text-gray-900 dark:text-white">{book.title}</span>
      ),
    },
    {
      key: 'authors',
      label: 'Authors',
      render: (book: LibraryBook) => (
        <span className="text-gray-600 dark:text-gray-400">{book.authors?.join(', ') || '-'}</span>
      ),
    },
    {
      key: 'isbn',
      label: 'ISBN',
      render: (book: LibraryBook) => (
        <span className="text-gray-600 dark:text-gray-400">{book.isbn || '-'}</span>
      ),
    },
    {
      key: 'category',
      label: 'Category',
      sortable: true,
      render: (book: LibraryBook) => (
        <span className="badge badge-info">{book.category || 'General'}</span>
      ),
    },
    {
      key: 'shelfLocation',
      label: 'Shelf',
      render: (book: LibraryBook) => (
        <span className="text-gray-600 dark:text-gray-400">{book.shelfLocation || '-'}</span>
      ),
    },
    {
      key: 'totalCopies',
      label: 'Copies',
      sortable: true,
      render: (book: LibraryBook) => (
        <span className="text-gray-700 dark:text-gray-300">
          <span className="font-medium">{book.availableCopies}</span>
          <span className="text-gray-400"> / {book.totalCopies}</span>
        </span>
      ),
    },
    {
      key: 'isActive',
      label: 'Status',
      render: (book: LibraryBook) => (
        <span className={`badge ${book.isActive ? 'badge-success' : 'badge-danger'}`}>
          {book.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">Library Books</h1>
        <div className="flex items-center gap-2">
          <button className="btn-secondary" onClick={() => navigate('/library/loans')}>
            <FaUndo className="w-4 h-4 mr-1.5" />
            Loans
          </button>
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            <FaPlus className="w-4 h-4 mr-1.5" />
            Add Book
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by title, author, ISBN..."
            className="input-field pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input-field w-full sm:w-44"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="">All Categories</option>
          {Array.from(new Set(books.map((b) => b.category).filter(Boolean))).map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          className="input-field w-full sm:w-44"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Status</option>
          <option value="available">Available</option>
          <option value="issued">All Out</option>
        </select>
      </div>

      {error && !loading ? (
        <div className="card p-8 text-center">
          <p className="text-red-500 dark:text-red-400 mb-2">{error}</p>
          <button className="btn-secondary" onClick={fetchBooks}>
            Retry
          </button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={books}
          loading={loading}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}

      <Modal
        isOpen={showForm}
        onClose={handleFormClose}
        title={editBook ? 'Edit Book' : 'Add Book'}
        size="lg"
      >
        <BookForm
          book={editBook}
          onSuccess={handleFormSuccess}
          onCancel={handleFormClose}
        />
      </Modal>
    </div>
  );
}