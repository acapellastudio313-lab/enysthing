import { useState, FormEvent, useEffect } from 'react';
import { Candidate, User } from '../types';
import { X, Loader2, User as UserIcon, FileText, Target, Lightbulb, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { clsx } from 'clsx';

interface CandidateModalProps {
  candidate: Candidate | null;
  onClose: () => void;
  onSave: () => Promise<void>;
}

export default function CandidateModal({ candidate, onClose, onSave }: CandidateModalProps) {
  const [userId, setUserId] = useState<number | string>(candidate?.user_id || '');
  const [vision, setVision] = useState(candidate?.vision || '');
  const [mission, setMission] = useState(candidate?.mission || '');
  const [innovationProgram, setInnovationProgram] = useState(candidate?.innovation_program || '');
  const [name, setName] = useState(candidate?.name || '');
  const [photo, setPhoto] = useState(candidate?.avatar || '');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingUsers, setFetchingUsers] = useState(false);
  const [labels, setLabels] = useState({ label: 'Agen Perubahan', descLabel: 'Visi & Misi' });

  useEffect(() => {
    const fetchData = async () => {
      setFetchingUsers(true);
      try {
        const [usersRes, settingsRes] = await Promise.all([
          fetch('/api/admin/users'),
          fetch('/api/settings/general')
        ]);
        const usersData = await usersRes.json();
        const settingsData = await settingsRes.json();
        setUsers(usersData);
        if (settingsData.candidateLabel) {
          setLabels({
            label: settingsData.candidateLabel,
            descLabel: settingsData.candidateDescLabel || 'Visi & Misi'
          });
        }
      } catch (err) {
        console.error('Error fetching data:', err);
      } finally {
        setFetchingUsers(false);
      }
    };
    fetchData();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const url = candidate ? `/api/candidates/${candidate.id}` : '/api/candidates';
      const method = candidate ? 'PUT' : 'POST';
      
      const payload = candidate ? {
        vision,
        mission,
        innovation_program: innovationProgram,
        name,
        avatar: photo
      } : {
        user_id: Number(userId),
        vision,
        mission,
        innovation_program: innovationProgram,
        name,
        avatar: photo
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Failed to save candidate');
      
      toast.success(`Kandidat berhasil ${candidate ? 'diperbarui' : 'ditambahkan'}`);
      await onSave();
      onClose();
    } catch (err) {
      toast.error('Gagal menyimpan kandidat');
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
        className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden relative z-10"
      >
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{candidate ? 'Edit Kandidat' : 'Tambah Kandidat Baru'}</h2>
            <p className="text-sm text-slate-500">Kelola visi, misi, dan program inovasi kandidat</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white rounded-xl transition-colors text-slate-400 hover:text-slate-600 shadow-sm">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {!candidate && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Pilih Pengguna</label>
              <div className="relative">
                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <select
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-11 pr-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all outline-none appearance-none disabled:opacity-50"
                  value={userId}
                  onChange={(e) => {
                    const selected = users.find(u => u.id === Number(e.target.value));
                    setUserId(e.target.value);
                    if (selected) {
                      setName(selected.name);
                      setPhoto(selected.avatar);
                    }
                  }}
                  disabled={fetchingUsers}
                  required
                >
                  <option value="">Pilih Pengguna...</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} (@{u.username})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Nama Kandidat</label>
            <div className="relative">
              <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-11 pr-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all outline-none"
                placeholder="Nama Kandidat"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">URL Foto</label>
            <div className="relative">
              <ImageIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-11 pr-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all outline-none"
                placeholder="https://..."
                value={photo}
                onChange={(e) => setPhoto(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Visi</label>
            <div className="relative">
              <Target className="absolute left-4 top-4 w-4 h-4 text-slate-400" />
              <textarea
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-11 pr-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all outline-none min-h-[100px]"
                placeholder={`Tuliskan visi kandidat...`}
                value={vision}
                onChange={(e) => setVision(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Misi</label>
            <div className="relative">
              <FileText className="absolute left-4 top-4 w-4 h-4 text-slate-400" />
              <textarea
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-11 pr-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all outline-none min-h-[100px]"
                placeholder={`Tuliskan misi kandidat...`}
                value={mission}
                onChange={(e) => setMission(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">{labels.label}</label>
            <div className="relative">
              <Lightbulb className="absolute left-4 top-4 w-4 h-4 text-slate-400" />
              <textarea
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-11 pr-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all outline-none min-h-[100px]"
                placeholder={`Tuliskan ${labels.label.toLowerCase()} kandidat...`}
                value={innovationProgram}
                onChange={(e) => setInnovationProgram(e.target.value)}
                required
              />
            </div>
          </div>
        </form>

        <div className="px-8 py-6 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-white transition-all"
          >
            Batal
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-8 py-2.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (candidate ? 'Simpan Perubahan' : 'Tambah Kandidat')}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
