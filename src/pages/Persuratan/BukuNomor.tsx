import React, { useState, useEffect } from 'react';
import { User, Pimpinan, BukuEntry } from '../../types';
import { 
  Plus, 
  Search, 
  Filter, 
  Hash, 
  Calendar, 
  User as UserIcon, 
  Tag,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronRight,
  Copy,
  ExternalLink,
  Trash2,
  Edit2,
  Settings,
  ArrowUpDown,
  XCircle,
  Download
} from 'lucide-react';
import { collection, query, onSnapshot, orderBy, runTransaction, doc, serverTimestamp, addDoc, deleteDoc, updateDoc, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { toast } from 'sonner';
import { clsx } from 'clsx';
import { toRoman } from '../../utils';

const CLASSIFICATION_CODES = [
  { code: 'HK', label: 'HK (Hukum)' },
  { code: 'KP', label: 'KP (Kepegawaian)' },
  { code: 'KU', label: 'KU (Keuangan)' },
  { code: 'HM', label: 'HM (Humas)' },
  { code: 'PL', label: 'PL (Perlengkapan)' },
  { code: 'OT', label: 'OT (Organisasi & Tata Laksana)' },
  { code: 'TI', label: 'TI (Teknologi Informasi)' },
  { code: 'PT', label: 'PT (Perencanaan)' },
  { code: 'UM', label: 'UM (Umum)' },
  { code: 'PS', label: 'PS (Persidangan)' },
];

export default function BukuNomor({ user }: { user: User }) {
  const [entries, setEntries] = useState<BukuEntry[]>([]);
  const [pimpinanList, setPimpinanList] = useState<Pimpinan[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPimpinanModal, setShowPimpinanModal] = useState(false);
  const [activeType, setActiveType] = useState<'masuk' | 'keluar'>('keluar');
  const [formData, setFormData] = useState({
    kode_klasifikasi: 'HK',
    perihal: '',
    tujuan: '',
    pimpinan_id: '',
    tanggal: new Date().toISOString().split('T')[0]
  });
  const [pimpinanForm, setPimpinanForm] = useState({
    nama: '',
    jabatan: '',
    nip: '',
    id: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all');
  const [selectedEntry, setSelectedEntry] = useState<BukuEntry | null>(null);
  const [editingEntry, setEditingEntry] = useState<BukuEntry | null>(null);
  const [showDetailEntryModal, setShowDetailEntryModal] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  useEffect(() => {
    const q = query(collection(db, 'buku_kendali'), orderBy('nomor_urut', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setEntries(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as BukuEntry)));
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'pimpinan'), orderBy('created_at', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setPimpinanList(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Pimpinan)));
    });
    return () => unsubscribe();
  }, []);

  const handleAmbilNomor = async () => {
    if (!formData.perihal || !formData.tujuan) {
      toast.error('Harap isi perihal dan tujuan');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingEntry) {
        await updateDoc(doc(db, 'buku_kendali', editingEntry.id), {
          kode_klasifikasi: formData.kode_klasifikasi,
          perihal: formData.perihal,
          tujuan: formData.tujuan,
          pimpinan_id: formData.pimpinan_id,
          tanggal: formData.tanggal
        });
        toast.success('Entry berhasil diperbarui');
      } else {
        await runTransaction(db, async (transaction) => {
          const counterId = `surat_${activeType}_${new Date(formData.tanggal).getFullYear()}`;
          const counterRef = doc(db, 'counters', counterId);
          const counterDoc = await transaction.get(counterRef);
          
          let nextNumber = 1;
          if (counterDoc.exists()) {
            nextNumber = counterDoc.data().current + 1;
          }

          const now = new Date(formData.tanggal);
          const romanMonth = toRoman(now.getMonth() + 1);
          const year = now.getFullYear();
          const fullNumber = `${String(nextNumber).padStart(3, '0')}/${formData.kode_klasifikasi}/${romanMonth}/${year}`;

          const pimpinan = pimpinanList.find(p => p.id === formData.pimpinan_id);

          const newEntryRef = doc(collection(db, 'buku_kendali'));
          transaction.set(newEntryRef, {
            nomor_urut: nextNumber,
            nomor_full: fullNumber,
            kode_klasifikasi: formData.kode_klasifikasi,
            perihal: formData.perihal,
            tujuan: formData.tujuan,
            petugas: user.name,
            pimpinan: pimpinan?.nama || '',
            pimpinan_id: formData.pimpinan_id,
            status: 'Draft',
            type: activeType,
            tanggal: formData.tanggal,
            createdAt: serverTimestamp()
          });

          transaction.set(counterRef, { current: nextNumber }, { merge: true });
        });
        toast.success('Nomor surat berhasil diambil');
      }
      setShowAddModal(false);
      setEditingEntry(null);
      setFormData({ 
        kode_klasifikasi: 'HK', 
        perihal: '', 
        tujuan: '', 
        pimpinan_id: '',
        tanggal: new Date().toISOString().split('T')[0]
      });
    } catch (err) {
      console.error(err);
      toast.error('Gagal memproses nomor surat');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSavePimpinan = async () => {
    if (!pimpinanForm.nama || !pimpinanForm.jabatan) {
      toast.error('Nama dan Jabatan wajib diisi');
      return;
    }

    try {
      if (pimpinanForm.id) {
        await updateDoc(doc(db, 'pimpinan', pimpinanForm.id), {
          nama: pimpinanForm.nama,
          jabatan: pimpinanForm.jabatan,
          nip: pimpinanForm.nip
        });
        toast.success('Pimpinan berhasil diperbarui');
      } else {
        await addDoc(collection(db, 'pimpinan'), {
          nama: pimpinanForm.nama,
          jabatan: pimpinanForm.jabatan,
          nip: pimpinanForm.nip,
          is_active: true,
          created_at: new Date().toISOString()
        });
        toast.success('Pimpinan berhasil ditambahkan');
      }
      setPimpinanForm({ nama: '', jabatan: '', nip: '', id: '' });
    } catch (err) {
      console.error(err);
      toast.error('Gagal menyimpan pimpinan');
    }
  };

  const handleEdit = (entry: BukuEntry) => {
    setEditingEntry(entry);
    setFormData({
      kode_klasifikasi: entry.kode_klasifikasi,
      perihal: entry.perihal,
      tujuan: entry.tujuan,
      pimpinan_id: entry.pimpinan_id || '',
      tanggal: entry.tanggal
    });
    setShowAddModal(true);
  };

  const handleDeletePimpinan = async (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Hapus Pimpinan',
      message: 'Hapus pimpinan ini?',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        try {
          await deleteDoc(doc(db, 'pimpinan', id));
          toast.success('Pimpinan berhasil dihapus');
        } catch (err) {
          console.error(err);
          toast.error('Gagal menghapus pimpinan');
        }
      }
    });
  };

  const handleDelete = async (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Hapus Entry',
      message: 'Apakah Anda yakin ingin menghapus entry ini?',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        try {
          await deleteDoc(doc(db, 'buku_kendali', id));
          toast.success('Entry berhasil dihapus');
        } catch (err) {
          console.error(err);
          toast.error('Gagal menghapus entry');
        }
      }
    });
  };

  const filteredEntries = entries.filter(e => {
    const matchesType = e.type === activeType;
    const matchesSearch = e.nomor_full.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          e.perihal.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          e.tanggal.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          e.tujuan.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          e.petugas.toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchesFilter = true;
    const entryDate = new Date(e.tanggal);
    const today = new Date();
    
    if (filter === 'today') {
      matchesFilter = e.tanggal === today.toISOString().split('T')[0];
    } else if (filter === '7days') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(today.getDate() - 7);
      matchesFilter = entryDate >= sevenDaysAgo;
    } else if (filter === 'month') {
      matchesFilter = entryDate.getMonth() === today.getMonth() && entryDate.getFullYear() === today.getFullYear();
    } else if (filter === 'year') {
      matchesFilter = entryDate.getFullYear() === today.getFullYear();
    }
    
    return matchesType && matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Buku Kendali & Pengambilan Nomor</h2>
          <p className="text-xs text-slate-500">Sistem penomoran otomatis untuk mencegah duplikasi</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowPimpinanModal(true)}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all"
          >
            <Settings className="w-5 h-5" />
            Kelola Pimpinan
          </button>
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"
          >
            <Plus className="w-5 h-5" />
            Ambil Nomor Baru
          </button>
        </div>
      </div>

      {/* Type Toggle */}
      <div className="flex p-1 bg-slate-100 rounded-2xl w-fit">
        <button 
          onClick={() => setActiveType('keluar')}
          className={clsx(
            "px-6 py-2 rounded-xl text-sm font-bold transition-all",
            activeType === 'keluar' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
        >
          Surat Keluar
        </button>
        <button 
          onClick={() => setActiveType('masuk')}
          className={clsx(
            "px-6 py-2 rounded-xl text-sm font-bold transition-all",
            activeType === 'masuk' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
        >
          Surat Masuk
        </button>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center gap-4">
          <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
            <Hash className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nomor Terakhir ({activeType})</p>
            <p className="text-lg font-bold text-slate-900">{filteredEntries[0]?.nomor_dokumen || filteredEntries[0]?.nomor_full || '-'}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center gap-4">
          <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
            <Tag className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Draft</p>
            <p className="text-lg font-bold text-slate-900">{filteredEntries.filter(e => e.status === 'Draft').length}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center gap-4">
          <div className="p-3 bg-purple-50 rounded-xl text-purple-600">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Telah Digunakan</p>
            <p className="text-lg font-bold text-slate-900">{filteredEntries.filter(e => e.status === 'Digunakan').length}</p>
          </div>
        </div>
      </div>

      {/* Table Section */}
      {/* Search & Filter */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input 
            placeholder="Cari nomor atau perihal..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl outline-none focus:border-emerald-500 shadow-sm"
          />
        </div>
        <button className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 rounded-2xl font-bold text-slate-600 hover:bg-slate-50 transition-colors shadow-sm">
          <Filter className="w-5 h-5" />
          <select 
            className="bg-transparent outline-none"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">Semua Waktu</option>
            <option value="today">Hari Ini</option>
            <option value="7days">7 Hari Terakhir</option>
            <option value="month">Bulan Ini</option>
            <option value="year">Tahun Ini</option>
          </select>
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-widest">
              <tr>
                <th className="px-6 py-5">Nomor Urut</th>
                <th className="px-6 py-5">Nomor Dokumen</th>
                <th className="px-6 py-5">Kode Klasifikasi</th>
                <th className="px-6 py-5">Tanggal</th>
                <th className="px-6 py-5">Perihal</th>
                <th className="px-6 py-5">Tujuan</th>
                <th className="px-6 py-5">Petugas</th>
                <th className="px-6 py-5">Status</th>
                <th className="px-6 py-5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredEntries.map((entry) => (
                <tr 
                  key={entry.id} 
                  onClick={() => { setSelectedEntry(entry); setShowDetailEntryModal(true); }}
                  className="hover:bg-slate-50 transition-colors group cursor-pointer"
                >
                  <td className="px-6 py-5">
                    <div className="flex flex-col gap-1">
                      <span className="font-mono font-bold text-slate-900 text-sm whitespace-nowrap">#{entry.nomor_urut}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <span className="text-xs font-mono font-bold text-slate-600 whitespace-nowrap bg-slate-100 px-2 py-1 rounded-md">{entry.nomor_full || '-'}</span>
                  </td>
                  <td className="px-6 py-5">
                    <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded-md">{entry.kode_klasifikasi || '-'}</span>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-600 whitespace-nowrap">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {entry.tanggal}
                    </div>
                  </td>
                  <td className="px-6 py-5 min-w-[250px]">
                    <p className="text-sm font-bold text-slate-800 leading-snug">{entry.perihal}</p>
                  </td>
                  <td className="px-6 py-5">
                    <p className="text-xs font-bold text-slate-600 bg-blue-50 text-blue-700 px-2 py-1 rounded-md inline-block">{entry.tujuan}</p>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-2 whitespace-nowrap">
                      <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-700 border border-white shadow-sm">
                        {entry.petugas.charAt(0)}
                      </div>
                      <span className="text-xs font-bold text-slate-700">{entry.petugas}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <span className={clsx(
                      "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap shadow-sm",
                      entry.status === 'Draft' ? "bg-amber-100 text-amber-700 border border-amber-200" : 
                      entry.status === 'Digunakan' ? "bg-emerald-100 text-emerald-700 border border-emerald-200" : 
                      "bg-slate-100 text-slate-700 border border-slate-200"
                    )}>
                      {entry.status}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-right" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2">
                      {entry.file_url && (
                        <>
                          <a 
                            href={entry.file_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="p-2.5 bg-white border border-slate-200 text-slate-500 hover:text-emerald-600 hover:border-emerald-200 hover:shadow-sm rounded-xl transition-all"
                            title="Lihat Dokumen"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </>
                      )}
                      <button 
                        onClick={() => { setSelectedEntry(entry); setShowDetailEntryModal(true); }}
                        className="p-2.5 bg-slate-900 text-white hover:bg-slate-800 rounded-xl transition-all shadow-sm"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                      {(user.role === 'admin' || user.persuratan_role === 'petugas') && (
                        <>
                          <button 
                            onClick={() => handleEdit(entry)}
                            className="p-2.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl transition-all"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDelete(entry.id)}
                            className="p-2.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredEntries.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <AlertCircle className="w-8 h-8 text-slate-200" />
                      <p className="text-sm text-slate-400 font-medium">Belum ada nomor yang diambil untuk {activeType}</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-900">Ambil Nomor {activeType === 'masuk' ? 'Surat Masuk' : 'Surat Keluar'}</h3>
                <p className="text-xs text-slate-500">Nomor akan di-generate secara otomatis</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-white rounded-full transition-colors">
                <XCircle className="w-6 h-6 text-slate-400" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Tanggal</label>
                  <input 
                    type="date"
                    value={formData.tanggal}
                    onChange={e => setFormData({...formData, tanggal: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Kode Klasifikasi</label>
                  <select 
                    value={formData.kode_klasifikasi}
                    onChange={e => setFormData({...formData, kode_klasifikasi: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:border-emerald-500"
                  >
                    {CLASSIFICATION_CODES.map(c => (
                      <option key={c.code} value={c.code}>{c.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Perihal</label>
                <textarea 
                  value={formData.perihal}
                  onChange={e => setFormData({...formData, perihal: e.target.value})}
                  placeholder="Contoh: Permohonan Izin Cuti Tahunan..."
                  rows={3}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm outline-none focus:border-emerald-500 resize-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Tujuan Surat</label>
                <input 
                  value={formData.tujuan}
                  onChange={e => setFormData({...formData, tujuan: e.target.value})}
                  placeholder="Contoh: Kepala Biro Hukum MA RI"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Pimpinan Penandatangan</label>
                <select 
                  value={formData.pimpinan_id}
                  onChange={e => setFormData({...formData, pimpinan_id: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:border-emerald-500"
                >
                  <option value="">Pilih Pimpinan...</option>
                  {pimpinanList.map(p => (
                    <option key={p.id} value={p.id}>{p.nama} - {p.jabatan}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="p-6 bg-slate-50 flex gap-3">
              <button 
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Batal
              </button>
              <button 
                onClick={handleAmbilNomor}
                disabled={isSubmitting}
                className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? <Clock className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                {isSubmitting ? 'Memproses...' : 'Konfirmasi & Ambil'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pimpinan Management Modal */}
      {showPimpinanModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-900">Kelola Daftar Pimpinan</h3>
                <p className="text-xs text-slate-500">Tambah, edit, atau hapus pimpinan penandatangan</p>
              </div>
              <button onClick={() => setShowPimpinanModal(false)} className="p-2 hover:bg-white rounded-full transition-colors">
                <XCircle className="w-6 h-6 text-slate-400" />
              </button>
            </div>
            
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Form Pimpinan</h4>
                <div className="space-y-3">
                  <input 
                    placeholder="Nama Lengkap"
                    value={pimpinanForm.nama}
                    onChange={e => setPimpinanForm({...pimpinanForm, nama: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none focus:border-emerald-500"
                  />
                  <input 
                    placeholder="Jabatan"
                    value={pimpinanForm.jabatan}
                    onChange={e => setPimpinanForm({...pimpinanForm, jabatan: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none focus:border-emerald-500"
                  />
                  <input 
                    placeholder="NIP"
                    value={pimpinanForm.nip}
                    onChange={e => setPimpinanForm({...pimpinanForm, nip: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none focus:border-emerald-500"
                  />
                  <button 
                    onClick={handleSavePimpinan}
                    className="w-full py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
                  >
                    {pimpinanForm.id ? <Edit2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    {pimpinanForm.id ? 'Update Pimpinan' : 'Tambah Pimpinan'}
                  </button>
                  {pimpinanForm.id && (
                    <button 
                      onClick={() => setPimpinanForm({ nama: '', jabatan: '', nip: '', id: '' })}
                      className="w-full py-2 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
                    >
                      Batal Edit
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Daftar Pimpinan</h4>
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                  {pimpinanList.map(p => (
                    <div key={p.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between group">
                      <div>
                        <p className="text-sm font-bold text-slate-800">{p.nama}</p>
                        <p className="text-[10px] text-slate-500">{p.jabatan}</p>
                        <p className="text-[10px] text-slate-400">NIP. {p.nip || '-'}</p>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button 
                          onClick={() => setPimpinanForm({ ...p, id: p.id })}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => handleDeletePimpinan(p.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Detail Entry Modal */}
      {showDetailEntryModal && selectedEntry && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-slate-900 rounded-2xl text-white">
                  <Hash className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Detail Nomor Buku</h3>
                  <p className="text-xs text-slate-500 font-mono">{selectedEntry.nomor_full}</p>
                </div>
              </div>
              <button onClick={() => setShowDetailEntryModal(false)} className="p-2 hover:bg-white rounded-full transition-colors">
                <XCircle className="w-6 h-6 text-slate-400" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Nomor Urut</label>
                  <p className="text-lg font-bold text-slate-900">{selectedEntry.nomor_urut}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Tanggal</label>
                  <p className="text-sm font-bold text-slate-900">{selectedEntry.tanggal}</p>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Perihal</label>
                <p className="text-sm font-bold text-slate-900 leading-relaxed">{selectedEntry.perihal}</p>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Tujuan / Penerima</label>
                <p className="text-sm font-bold text-slate-900">{selectedEntry.tujuan}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Petugas</label>
                  <p className="text-sm font-bold text-slate-900">{selectedEntry.petugas}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Status</label>
                  <span className={clsx(
                    "inline-block px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-tight",
                    selectedEntry.status === 'Draft' ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                  )}>
                    {selectedEntry.status}
                  </span>
                </div>
              </div>

              {selectedEntry.file_data && (
                <div className="pt-4 border-t border-slate-100">
                  <a 
                    href={selectedEntry.file_data} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-100"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Buka Dokumen Terkait
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-slate-900 mb-2">{confirmDialog.title}</h3>
            <p className="text-slate-600 mb-6">{confirmDialog.message}</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium transition-colors"
              >
                Batal
              </button>
              <button
                onClick={confirmDialog.onConfirm}
                className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors"
              >
                Ya, Lanjutkan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
