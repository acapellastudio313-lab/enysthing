import { useState } from 'react';
import { toast } from 'sonner';
import { User } from '../types';
import { X, Loader2, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface DeleteUserModalProps {
  user: User;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export default function DeleteUserModal({ user, onClose, onConfirm }: DeleteUserModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to delete user');
      }

      toast.success('Pengguna berhasil dihapus');
      await onConfirm();
      onClose();
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden relative z-10"
      >
        <div className="p-8 text-center">
          <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-red-100">
            <AlertTriangle className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Hapus Pengguna</h2>
          <p className="text-slate-500 leading-relaxed mb-8">
            Apakah Anda yakin ingin menghapus <span className="font-bold text-slate-900">@{user.username}</span>? 
            Tindakan ini akan menghapus semua data terkait dan tidak dapat dibatalkan.
          </p>
          
          <div className="flex flex-col gap-3">
            <button
              onClick={handleDelete}
              disabled={loading}
              className="w-full py-3.5 bg-red-600 text-white rounded-2xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-100 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Ya, Hapus Permanen'}
            </button>
            <button
              onClick={onClose}
              disabled={loading}
              className="w-full py-3.5 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all disabled:opacity-50"
            >
              Batal
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
