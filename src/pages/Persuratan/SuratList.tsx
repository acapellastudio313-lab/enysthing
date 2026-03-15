import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { User, Surat } from '../../types';
import { 
  Search, 
  Filter, 
  MoreVertical, 
  Eye, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  MessageSquare,
  User as UserIcon,
  ChevronRight,
  PenTool,
  QrCode,
  XCircle,
  Download,
  ExternalLink as ExternalLinkIcon,
  FileText,
  Send,
  Calendar,
  Tag,
  Hash,
  ArrowRight
} from 'lucide-react';
import { sendNotification } from '../../lib/notifications';
import { collection, query, onSnapshot, where, orderBy, doc, updateDoc, arrayUnion, serverTimestamp, addDoc, runTransaction, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { clsx } from 'clsx';
import { toast } from 'sonner';
import { toRoman } from '../../utils';
import SuratForm from './SuratForm';
import SignatureModal from '../../components/SignatureModal';

export default function SuratList({ user, type, suratId }: { user: User, type: 'masuk' | 'keluar', suratId?: string | null }) {
  const [surat, setSurat] = useState<Surat[]>([]);
  const [selectedSurat, setSelectedSurat] = useState<Surat | null>(null);
  const [previewFile, setPreviewFile] = useState<string | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDisposisiModal, setShowDisposisiModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [disposisiNote, setDisposisiNote] = useState('');
  const [tagUserId, setTagUserId] = useState('');
  const [signature, setSignature] = useState<string | null>(null);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all');
  const location = useLocation();
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
    const q = query(
      collection(db, 'users'),
      where('persuratan_role', 'in', ['pimpinan', 'petugas'])
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      setAvailableUsers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as User)));
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, 'surat'), 
      where('type', '==', type)
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Surat));
      data.sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || new Date(0);
        const dateB = b.createdAt?.toDate?.() || new Date(0);
        return dateB.getTime() - dateA.getTime();
      });
      setSurat(data);
    }, (error) => {
      console.error("Error fetching surat:", error);
      toast.error("Gagal memuat data surat");
    });
    return () => unsubscribe();
  }, [type]);

  useEffect(() => {
    if (surat.length === 0) return;
    
    // Check prop first
    if (suratId) {
      const targetSurat = surat.find(s => s.id === suratId);
      if (targetSurat) {
        setSelectedSurat(targetSurat);
        setShowDetailModal(true);
        return;
      }
    }

    // Fallback to URL params
    const params = new URLSearchParams(location.search);
    const urlSuratId = params.get('suratId');
    if (urlSuratId) {
      const targetSurat = surat.find(s => s.id === urlSuratId);
      if (targetSurat) {
        setSelectedSurat(targetSurat);
        setShowDetailModal(true);
        // Clean up URL
        window.history.replaceState({}, '', window.location.pathname + '?tab=' + params.get('tab'));
      }
    }
  }, [location.search, surat, suratId]);

  const handleDisposisi = async () => {
    if (!selectedSurat || !tagUserId) {
      toast.error('Harap pilih tujuan disposisi');
      return;
    }
    const targetUser = availableUsers.find(u => u.id === tagUserId);
    try {
      await updateDoc(doc(db, 'surat', selectedSurat.id), {
        disposisi: arrayUnion({
          note: disposisiNote,
          from: user.name,
          to: targetUser?.name || 'Unknown',
          toId: tagUserId,
          createdAt: new Date(),
          signature: signature || null
        })
      });
      
      await sendNotification(
        tagUserId,
        `Disposisi baru dari ${user.name} untuk surat nomor ${selectedSurat.nomor}: ${disposisiNote}`,
        `/apps/persuratan?tab=persuratan_surat_${type}&suratId=${selectedSurat.id}`
      );

      toast.success('Disposisi berhasil dikirim');
      setShowDisposisiModal(false);
      setDisposisiNote('');
      setTagUserId('');
      setSignature(null);
    } catch (err) {
      console.error(err);
      toast.error('Gagal mengirim disposisi');
    }
  };

  const handleAkhiriDisposisi = async () => {
    if (!selectedSurat) return;
    try {
      await updateDoc(doc(db, 'surat', selectedSurat.id), {
        status: 'approved',
        disposisi_selesai: true,
        disposisi_selesai_at: serverTimestamp(),
        disposisi_selesai_by: user.name
      });
      toast.success('Disposisi berhasil diakhiri');
      setShowDetailModal(false);
    } catch (err) {
      console.error(err);
      toast.error('Gagal mengakhiri disposisi');
    }
  };

  const handleTeruskanKeBukuNomor = async (item: Surat) => {
    if (item.buku_nomor_id) {
      toast.info('Surat sudah terdaftar di Buku Nomor');
      return;
    }

    setProcessingId(item.id);
    try {
      await runTransaction(db, async (transaction) => {
        // Use year from the surat date for the counter
        const year = new Date(item.tanggal).getFullYear();
        const counterId = `surat_${item.type}_${year}`;
        const counterRef = doc(db, 'counters', counterId);
        const counterDoc = await transaction.get(counterRef);
        
        let nextNumber = 1;
        if (counterDoc.exists()) {
          nextNumber = counterDoc.data().current + 1;
        }

        const now = new Date(item.tanggal);
        const romanMonth = toRoman(now.getMonth() + 1);
        const fullNumber = `${String(nextNumber).padStart(3, '0')}/${item.klasifikasi}/${romanMonth}/${year}`;

        const newEntryRef = doc(collection(db, 'buku_kendali'));
        transaction.set(newEntryRef, {
          nomor_urut: nextNumber,
          nomor_full: fullNumber,
          kode_klasifikasi: item.klasifikasi,
          perihal: item.perihal,
          tujuan: item.type === 'masuk' ? 'Instansi Internal' : (item.tujuan || '-'),
          petugas: user.name,
          status: 'Digunakan',
          type: item.type,
          tanggal: item.tanggal,
          nomor_dokumen: item.nomor,
          file_data: item.file_data || '',
          surat_id: item.id,
          createdAt: serverTimestamp()
        });

        transaction.update(doc(db, 'surat', item.id), {
          buku_nomor_id: newEntryRef.id,
          nomor_buku: fullNumber
        });

        transaction.set(counterRef, { current: nextNumber }, { merge: true });
      });

      await sendNotification(
        item.createdBy,
        `Surat Anda telah diteruskan ke Buku Nomor: ${item.perihal}`,
        `/apps/persuratan`
      );

      toast.success('Berhasil diteruskan ke Buku Nomor');
    } catch (err) {
      console.error(err);
      toast.error('Gagal meneruskan ke Buku Nomor');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Hapus Surat',
      message: 'Apakah Anda yakin ingin menghapus surat ini?',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        try {
          await runTransaction(db, async (transaction) => {
            const docRef = doc(db, 'surat', id);
            const docSnap = await transaction.get(docRef);
            if (!docSnap.exists()) return;
            
            const data = docSnap.data();
            if (data.buku_nomor_id) {
              transaction.delete(doc(db, 'buku_kendali', data.buku_nomor_id));
            }
            transaction.delete(docRef);
          });
          toast.success('Surat berhasil dihapus');
          setShowDetailModal(false);
        } catch (err) {
          console.error(err);
          toast.error('Gagal menghapus surat');
        }
      }
    });
  };

  const filteredSurat = surat.filter(item => {
    const matchesSearch = item.nomor.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.perihal.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (type === 'masuk' ? item.pengirim.toLowerCase().includes(searchTerm.toLowerCase()) : item.tujuan.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesFilter = filter === 'all' || item.status === filter;
    
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6">
      {/* Search & Filter */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input 
            placeholder="Cari nomor surat, perihal, atau pengirim..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
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
            <option value="all">Semua Status</option>
            <option value="approved">Disetujui</option>
            <option value="pending">Menunggu</option>
          </select>
        </button>
      </div>

      {/* List */}
      <div className="grid grid-cols-1 gap-4">
        {filteredSurat.map((item) => (
          <div 
            key={item.id}
            onClick={() => { setSelectedSurat(item); setShowDetailModal(true); }}
            className="bg-white border border-slate-200 rounded-2xl p-6 hover:shadow-lg transition-all group relative overflow-hidden cursor-pointer"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={clsx(
                  "p-2 rounded-xl",
                  item.status === 'approved' ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                )}>
                  {item.status === 'approved' ? <CheckCircle2 className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-mono font-bold text-slate-900">{item.nomor}</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.klasifikasi} • {item.tanggal}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={clsx(
                  "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-tight",
                  item.status === 'approved' ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                )}>
                  {item.status === 'approved' ? 'Disetujui' : 'Menunggu'}
                </span>
                <button className="p-2 text-slate-400 hover:bg-slate-50 rounded-lg">
                  <MoreVertical className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="mb-6">
              <h4 className="font-bold text-slate-800 mb-1">{item.perihal}</h4>
              <p className="text-sm text-slate-500 line-clamp-2">{type === 'masuk' ? `Dari: ${item.pengirim}` : `Tujuan: ${item.tujuan}`}</p>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-50">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600">
                  {item.authorName.charAt(0)}
                </div>
                <span className="text-xs text-slate-500 font-medium">Petugas: {item.authorName}</span>
              </div>
              <div className="flex items-center gap-2">
                {item.file_data && (
                  <div className="flex items-center gap-1 mr-2" onClick={e => e.stopPropagation()}>
                    <a 
                      href={item.file_data} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="p-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-colors"
                      title="Lihat Dokumen"
                    >
                      <ExternalLinkIcon className="w-4 h-4" />
                    </a>
                  </div>
                )}
                <button 
                  onClick={(e) => { e.stopPropagation(); setSelectedSurat(item); setShowDisposisiModal(true); }}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-50 text-slate-600 rounded-xl text-xs font-bold hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
                >
                  <MessageSquare className="w-4 h-4" />
                  Disposisi
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleTeruskanKeBukuNomor(item); }}
                  disabled={processingId === item.id || !!item.buku_nomor_id}
                  className={clsx(
                    "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all",
                    item.buku_nomor_id 
                      ? "bg-slate-100 text-slate-400 cursor-not-allowed" 
                      : "bg-slate-900 text-white hover:bg-slate-800"
                  )}
                >
                  {processingId === item.id ? <Clock className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                  {item.buku_nomor_id ? 'Sudah di Buku' : 'Tuskan ke Buku'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedSurat && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 pb-20">
          <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-600 rounded-2xl text-white shadow-lg shadow-emerald-100">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Detail Surat {type === 'masuk' ? 'Masuk' : 'Keluar'}</h3>
                  <p className="text-xs text-slate-500 font-mono">{selectedSurat.nomor}</p>
                </div>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="p-2 hover:bg-white rounded-full transition-colors">
                <XCircle className="w-6 h-6 text-slate-400" />
              </button>
            </div>

            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8 overflow-y-auto flex-1">
              <div className="space-y-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                    <Hash className="w-3 h-3" /> Nomor Surat
                  </label>
                  <p className="text-sm font-bold text-slate-900 font-mono bg-slate-50 p-3 rounded-xl border border-slate-100">
                    {selectedSurat.nomor}
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Tanggal Surat
                  </label>
                  <p className="text-sm font-bold text-slate-900 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    {selectedSurat.tanggal}
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                    <Tag className="w-3 h-3" /> Klasifikasi
                  </label>
                  <p className="text-sm font-bold text-slate-900 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    {selectedSurat.klasifikasi}
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                    <UserIcon className="w-3 h-3" /> {type === 'masuk' ? 'Pengirim' : 'Tujuan'}
                  </label>
                  <p className="text-sm font-bold text-slate-900 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    {type === 'masuk' ? selectedSurat.pengirim : selectedSurat.tujuan}
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" /> Perihal
                  </label>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <p className="text-sm font-bold text-slate-900 leading-relaxed">{selectedSurat.perihal}</p>
                  </div>
                </div>

                {selectedSurat.ringkasan && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ringkasan AI</label>
                    <p className="text-xs text-slate-600 bg-emerald-50/50 p-4 rounded-xl border border-emerald-100 italic">
                      {selectedSurat.ringkasan}
                    </p>
                  </div>
                )}

                <div className="pt-4 border-t border-slate-100">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-3">Dokumen Lampiran</label>
                  {selectedSurat.file_data ? (
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => setPreviewFile(selectedSurat.file_data || null)}
                        className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
                      >
                        <Eye className="w-4 h-4" />
                        Lihat Dokumen
                      </button>
                      <a 
                        href={selectedSurat.file_data} 
                        download="lampiran_surat.pdf"
                        className="p-3 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all"
                      >
                        <Download className="w-5 h-5" />
                      </a>
                    </div>
                  ) : (
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-center">
                      <p className="text-xs text-slate-400 italic">Tidak ada lampiran dokumen</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Preview Modal */}
              {previewFile && (
                <div className="fixed inset-0 bg-black/90 z-[600] flex items-center justify-center p-4">
                  <div className="bg-white w-full max-w-5xl h-[90vh] rounded-3xl overflow-hidden flex flex-col shadow-2xl">
                    <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-100 rounded-xl">
                          <FileText className="w-5 h-5 text-emerald-600" />
                        </div>
                        <h3 className="font-bold text-slate-900">Pratinjau Dokumen</h3>
                      </div>
                      <button onClick={() => setPreviewFile(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                        <XCircle className="w-6 h-6 text-slate-500" />
                      </button>
                    </div>
                    <div className="flex-1 bg-slate-100 relative overflow-hidden">
                      {previewFile.startsWith('data:application/pdf') ? (
                        <iframe src={previewFile} className="w-full h-full border-none" title="Preview PDF" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center p-4 overflow-auto">
                          <img 
                            src={previewFile} 
                            alt="Preview" 
                            className="max-w-full max-h-full object-contain shadow-lg rounded-lg" 
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Disposisi History */}
              {selectedSurat.disposisi && selectedSurat.disposisi.length > 0 && (
                <div className="md:col-span-2 space-y-4 pt-4 border-t border-slate-100">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Riwayat Disposisi</label>
                  <div className="space-y-3">
                    {selectedSurat.disposisi.map((d, i) => (
                      <div key={i} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-start gap-4">
                        <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-xs font-bold text-slate-600 shadow-sm shrink-0">
                          {d.from.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-xs font-bold text-slate-900">{d.from} <span className="text-slate-400 font-normal">→</span> {d.to}</p>
                          </div>
                          <p className="text-sm text-slate-600 italic mb-2">"{d.note}"</p>
                          {d.signature && (
                            <div className="mt-2 p-2 bg-white rounded-lg border border-slate-100 inline-block">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Ditandatangani oleh {d.from}</p>
                              <img src={d.signature} alt="Tanda Tangan" className="h-12 object-contain" />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex flex-wrap gap-3">
              <button 
                onClick={() => { setShowDetailModal(false); setShowDisposisiModal(true); }}
                className="flex-1 min-w-[140px] py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors flex items-center justify-center gap-2"
              >
                <MessageSquare className="w-4 h-4" />
                Disposisi
              </button>
              <button 
                onClick={() => handleTeruskanKeBukuNomor(selectedSurat)}
                disabled={processingId === selectedSurat.id || !!selectedSurat.buku_nomor_id}
                className={clsx(
                  "flex-1 min-w-[140px] py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg",
                  selectedSurat.buku_nomor_id 
                    ? "bg-slate-200 text-slate-500 cursor-not-allowed shadow-none" 
                    : "bg-slate-900 text-white hover:bg-slate-800 shadow-slate-200"
                )}
              >
                {processingId === selectedSurat.id ? <Clock className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                {selectedSurat.buku_nomor_id ? 'Sudah di Buku' : 'Tuskan ke Buku'}
              </button>
              
              {selectedSurat.status !== 'approved' && !selectedSurat.disposisi_selesai && (
                <button 
                  onClick={handleAkhiriDisposisi}
                  className="flex-1 min-w-[140px] py-3 bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl font-bold hover:bg-emerald-200 transition-colors flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Akhiri Disposisi
                </button>
              )}
              
              {(user.role === 'admin' || user.persuratan_role === 'petugas') && (
                <>
                  <button 
                    onClick={() => { setShowDetailModal(false); setShowEditModal(true); }}
                    className="px-4 py-3 bg-blue-50 text-blue-600 border border-blue-100 rounded-xl font-bold hover:bg-blue-100 transition-colors flex items-center justify-center gap-2"
                  >
                    <PenTool className="w-4 h-4" />
                    Edit
                  </button>
                  <button 
                    onClick={() => handleDelete(selectedSurat.id)}
                    className="px-4 py-3 bg-red-50 text-red-600 border border-red-100 rounded-xl font-bold hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
                  >
                    <XCircle className="w-4 h-4" />
                    Hapus
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Disposisi Modal */}
      {showDisposisiModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-900">Disposisi Surat</h3>
                <p className="text-xs text-slate-500">{selectedSurat?.nomor}</p>
              </div>
              <button onClick={() => setShowDisposisiModal(false)} className="p-2 hover:bg-white rounded-full transition-colors">
                <XCircle className="w-6 h-6 text-slate-400" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Instruksi / Catatan</label>
                <textarea 
                  value={disposisiNote}
                  onChange={e => setDisposisiNote(e.target.value)}
                  placeholder="Tulis instruksi disposisi di sini..."
                  rows={4}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm outline-none focus:border-emerald-500 resize-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Tag Akun (Teruskan Ke)</label>
                <div className="relative">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <select 
                    value={tagUserId}
                    onChange={e => setTagUserId(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-emerald-500 appearance-none"
                  >
                    <option value="">Pilih Petugas / Pimpinan...</option>
                    {availableUsers.map(u => (
                      <option key={u.id} value={u.id}>{u.name} ({u.persuratan_role})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Tanda Tangan (Opsional)</label>
                <button 
                  onClick={() => setShowSignatureModal(true)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 outline-none focus:border-emerald-500 flex items-center justify-between"
                >
                  <span className="flex items-center gap-2 font-bold text-sm">
                    <PenTool className="w-4 h-4" /> {signature ? 'Tanda Tangan Tersimpan' : 'Buat/Unggah Tanda Tangan'}
                  </span>
                  {signature && <img src={signature} alt="Signature" className="h-8 object-contain" />}
                </button>
              </div>
            </div>

            <div className="p-6 bg-slate-50 flex gap-3">
              <button 
                onClick={() => { setShowDisposisiModal(false); setSignature(null); }}
                className="flex-1 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Batal
              </button>
              <button 
                onClick={handleDisposisi}
                className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"
              >
                Kirim Disposisi
              </button>
            </div>
          </div>
        </div>
      )}

      <SignatureModal 
        isOpen={showSignatureModal} 
        onClose={() => setShowSignatureModal(false)} 
        onSave={(sig) => { setSignature(sig); setShowSignatureModal(false); }}
      />

      {/* Edit Modal */}
      {showEditModal && selectedSurat && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl animate-in zoom-in-95 max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-900">Edit Surat</h3>
              <button onClick={() => setShowEditModal(false)} className="p-2 hover:bg-white rounded-full transition-colors">
                <XCircle className="w-6 h-6 text-slate-400" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <SuratForm 
                user={user} 
                type={type} 
                initialData={selectedSurat} 
                onSuccess={() => {
                  setShowEditModal(false);
                  toast.success('Surat berhasil diperbarui');
                }} 
              />
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[700] p-4">
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
