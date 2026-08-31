import { useState, type FormEvent } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import type { LibraryBook } from '../../types';

interface BookFormProps {
  book: LibraryBook | null;
  onSuccess: () => void;
  onCancel: () => void;
}

interface BookFormState {
  title: string;
  authors: string;
  isbn: string;
  category: string;
  publisher: string;
  publishedYear: string;
  shelfLocation: string;
  language: string;
  totalCopies: string;
  keywords: string;
  isActive: boolean;
}

export default function BookForm({ book, onSuccess, onCancel }: BookFormProps) {
  const isEdit = !!book;
  const [form, setForm] = useState<BookFormState>({
    title: book?.title || '',
    authors: book?.authors?.join(', ') || '',
    isbn: book?.isbn || '',
    category: book?.category || '',
    publisher: book?.publisher || '',
    publishedYear: book?.publishedYear ? String(book.publishedYear) : '',
    shelfLocation: book?.shelfLocation || '',
    language: book?.language || '',
    totalCopies: book ? String(book.totalCopies) : '1',
    keywords: book?.keywords?.join(', ') || '',
    isActive: book?.isActive ?? true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (field: keyof BookFormState, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.title.trim()) errs.title = 'Title is required';
    if (form.totalCopies && (parseInt(form.totalCopies) < 1 || isNaN(parseInt(form.totalCopies)))) {
      errs.totalCopies = 'Copies must be at least 1';
    }
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setSubmitting(true);
    try {
      const payload = {
        title: form.title.trim(),
        authors: form.authors.split(',').map((a) => a.trim()).filter(Boolean),
        isbn: form.isbn.trim() || undefined,
        category: form.category.trim() || undefined,
        publisher: form.publisher.trim() || undefined,
        publishedYear: form.publishedYear ? parseInt(form.publishedYear) : undefined,
        shelfLocation: form.shelfLocation.trim() || undefined,
        language: form.language.trim() || undefined,
        totalCopies: parseInt(form.totalCopies) || 1,
        keywords: form.keywords.split(',').map((k) => k.trim()).filter(Boolean),
        isActive: form.isActive,
      };

      if (isEdit) {
        await api.put(`/library/books/${book._id}`, payload);
        toast.success('Book updated');
      } else {
        await api.post('/library/books', payload);
        toast.success('Book added');
      }
      onSuccess();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save book');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = (field: string) => `input-field ${errors[field] ? 'border-red-500' : ''}`;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="label">Title *</label>
          <input
            className={inputClass('title')}
            value={form.title}
            onChange={(e) => handleChange('title', e.target.value)}
          />
          {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title}</p>}
        </div>
        <div className="md:col-span-2">
          <label className="label">Authors (comma separated)</label>
          <input
            className="input-field"
            value={form.authors}
            onChange={(e) => handleChange('authors', e.target.value)}
            placeholder="e.g. Jane Doe, John Smith"
          />
        </div>
        <div>
          <label className="label">ISBN</label>
          <input
            className="input-field"
            value={form.isbn}
            onChange={(e) => handleChange('isbn', e.target.value)}
          />
        </div>
        <div>
          <label className="label">Category</label>
          <input
            className="input-field"
            value={form.category}
            onChange={(e) => handleChange('category', e.target.value)}
            placeholder="e.g. Fiction, Science, History"
          />
        </div>
        <div>
          <label className="label">Publisher</label>
          <input
            className="input-field"
            value={form.publisher}
            onChange={(e) => handleChange('publisher', e.target.value)}
          />
        </div>
        <div>
          <label className="label">Published Year</label>
          <input
            type="number"
            className="input-field"
            value={form.publishedYear}
            onChange={(e) => handleChange('publishedYear', e.target.value)}
          />
        </div>
        <div>
          <label className="label">Shelf Location</label>
          <input
            className="input-field"
            value={form.shelfLocation}
            onChange={(e) => handleChange('shelfLocation', e.target.value)}
            placeholder="e.g. A1, B2"
          />
        </div>
        <div>
          <label className="label">Language</label>
          <input
            className="input-field"
            value={form.language}
            onChange={(e) => handleChange('language', e.target.value)}
          />
        </div>
        <div>
          <label className="label">Total Copies</label>
          <input
            type="number"
            min={1}
            className={inputClass('totalCopies')}
            value={form.totalCopies}
            onChange={(e) => handleChange('totalCopies', e.target.value)}
          />
          {errors.totalCopies && <p className="text-red-500 text-xs mt-1">{errors.totalCopies}</p>}
        </div>
        <div className="md:col-span-2">
          <label className="label">Keywords (comma separated)</label>
          <input
            className="input-field"
            value={form.keywords}
            onChange={(e) => handleChange('keywords', e.target.value)}
            placeholder="e.g. adventure, classic, 19th century"
          />
        </div>
        {isEdit && (
          <div className="md:col-span-2 flex items-center gap-2">
            <input
              type="checkbox"
              id="book-active"
              className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              checked={form.isActive}
              onChange={(e) => handleChange('isActive', e.target.checked)}
            />
            <label htmlFor="book-active" className="text-sm text-gray-700 dark:text-gray-300">
              Active (available for lending)
            </label>
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Saving...' : isEdit ? 'Update Book' : 'Add Book'}
        </button>
      </div>
    </form>
  );
}