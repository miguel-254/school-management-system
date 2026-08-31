import { useState, useEffect, useCallback } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { FaFileAlt, FaSpinner, FaTrash } from 'react-icons/fa';
import type { ExamDocument } from '../../types';
import { useAuth } from '../../context/AuthContext';

interface DocumentsModalProps {
  onClose: () => void;
  onDeleted?: () => void;
}

function nameOf(ref: any): string {
  return ref && typeof ref === 'object' ? ref.name || '' : '';
}

export default function DocumentsModal({ onClose, onDeleted }: DocumentsModalProps) {
  const { isAcademicTeacher, isHeadteacher } = useAuth();
  const [documents, setDocuments] = useState<ExamDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const canManage = isAcademicTeacher || isHeadteacher;

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/exam-documents');
      setDocuments(data.data || []);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleDownload = async (doc: ExamDocument) => {
    setDownloading(doc._id);
    try {
      const { data } = await api.get(`/exam-documents/${doc._id}/download`, { responseType: 'blob' });
      const blob = new Blob([data]);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = doc.originalName;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Download failed');
    } finally {
      setDownloading(null);
    }
  };

  const handleDelete = async (doc: ExamDocument) => {
    if (!confirm(`Delete "${doc.title}"? The file will be permanently removed.`)) return;
    setDeleting(doc._id);
    try {
      await api.delete(`/exam-documents/${doc._id}`);
      toast.success('Document deleted');
      setDocuments((prev) => prev.filter((d) => d._id !== doc._id));
      onDeleted?.();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete document');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Documents are restricted to teachers assigned to the target class and subject.
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <FaSpinner className="w-5 h-5 text-gray-400 animate-spin" />
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-10 text-gray-400 dark:text-gray-500">
          <FaFileAlt className="w-8 h-8 mx-auto mb-2" />
          <p className="text-sm">No exam documents available for your classes and subjects</p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Class</th>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">Stream</th>
                <th className="px-4 py-3">Uploaded By</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {documents.map((doc) => (
                <tr key={doc._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900 dark:text-white">{doc.title}</p>
                    <p className="text-xs text-gray-400">
                      {(doc.size / 1024).toFixed(1)} KB · {new Date(doc.createdAt).toLocaleDateString()}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{nameOf(doc.class) || '-'}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{nameOf(doc.subject) || '-'}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{nameOf(doc.stream) || '-'}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                    {typeof doc.uploadedBy === 'object' && doc.uploadedBy
                      ? `${doc.uploadedBy.firstName} ${doc.uploadedBy.lastName}`
                      : '-'}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                        title="Download"
                        disabled={downloading === doc._id}
                        onClick={() => handleDownload(doc)}
                      >
                        {downloading === doc._id ? (
                          <FaSpinner className="w-4 h-4 animate-spin" />
                        ) : (
                          <FaFileAlt className="w-4 h-4" />
                        )}
                      </button>
                      {canManage && (
                        <button
                          className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title="Delete"
                          disabled={deleting === doc._id}
                          onClick={() => handleDelete(doc)}
                        >
                          <FaTrash className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}