import { useState } from 'react';
import { X, Loader2, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

interface ResetVotesModalProps {
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export default function ResetVotesModal({ onClose, onConfirm }: ResetVotesModalProps) {
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/reset-votes', {
        method: 'POST',
      });

      if (!res.ok) throw new Error('Failed to reset votes');

      toast.success('Seluruh suara berhasil direset');
      await onConfirm();
      onClose();
    } catch (err) {
      toast.error('Gagal mereset suara');
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
          <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-amber-100">
            <RotateCcw className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Reset Semua Suara</h2>
          <p className="text-slate-500 leading-relaxed mb-8">
            Apakah Anda yakin ingin menghapus <span className="font-bold text-slate-900">seluruh data suara</span> yang telah masuk? 
            Tindakan ini akan mengosongkan perolehan suara semua kandidat.
          </p>
          
          <div className="flex flex-col gap-3">
            <button
              onClick={handleReset}
              disabled={loading}
              className="w-full py-3.5 bg-amber-600 text-white rounded-2xl font-bold hover:bg-amber-700 transition-all shadow-lg shadow-amber-100 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Ya, Reset Sekarang'}
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
