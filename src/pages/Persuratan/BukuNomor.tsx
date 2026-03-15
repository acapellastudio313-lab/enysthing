import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { User, Pimpinan, BukuEntry } from '../../types';
import { Plus, Search, Filter, Hash, Calendar, User as UserIcon, Tag, CheckCircle2, Clock, AlertCircle, ChevronRight, Copy, ExternalLink, Trash2, Edit2, Settings, ArrowUpDown, XCircle, Download, MessageSquare, Eye, FileText, Camera, Upload, FileCheck, Sparkles } from 'lucide-react';
import { collection, query, onSnapshot, orderBy, runTransaction, doc, serverTimestamp, addDoc, deleteDoc, updateDoc, where, arrayUnion, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { getFileFromChunks, uploadFile } from '../../lib/db';
import { toast } from 'sonner';
import { clsx } from 'clsx';
import { sendNotification } from '../../lib/notifications';
import { toRoman } from '../../utils';
import { Loader2 } from 'lucide-react';
import { jsPDF } from 'jspdf';

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
    tanggal: new Date().toISOString().split('T')[0],
    custom_text: ''
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
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [selectedFileForPreview, setSelectedFileForPreview] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [showDisposisiModal, setShowDisposisiModal] = useState(false);
  const [disposisiNote, setDisposisiNote] = useState('');
  const [tagUserId, setTagUserId] = useState('');
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<BukuEntry | null>(null);
  const [editingEntry, setEditingEntry] = useState<BukuEntry | null>(null);
  const [showDetailEntryModal, setShowDetailEntryModal] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [isMerging, setIsMerging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const handlePreview = async (fileData: string | File) => {
    if (fileData instanceof File) {
      setSelectedFileForPreview(URL.createObjectURL(fileData));
      return;
    }

    if (!fileData) return;

    if (fileData.startsWith('http') || fileData.startsWith('blob:') || fileData.startsWith('data:')) {
      setSelectedFileForPreview(fileData);
    } else {
      // It's likely a Firestore file ID
      setIsPreviewLoading(true);
      try {
        const url = await getFileFromChunks(fileData);
        if (url) {
          setSelectedFileForPreview(url);
        } else {
          toast.error('Gagal memuat dokumen');
        }
      } catch (err) {
        console.error('Preview error:', err);
        toast.error('Gagal memuat dokumen');
      } finally {
        setIsPreviewLoading(false);
      }
    }
  };

  const handleDisposisi = async () => {
    if (!selectedEntry || !tagUserId) {
      toast.error('Harap pilih tujuan disposisi');
      return;
    }

    const targetUser = availableUsers.find(u => u.id === tagUserId);
    setIsSubmitting(true);
    try {
      // If linked to a surat, update the surat document too
      if (selectedEntry.surat_id) {
        await updateDoc(doc(db, 'surat', selectedEntry.surat_id), {
          disposisi: arrayUnion({
            note: disposisiNote,
            from: user.name,
            to: targetUser?.name || 'Unknown',
            toId: tagUserId,
            createdAt: new Date(),
            signature: null
          })
        });
        
        await sendNotification(
          tagUserId,
          `Disposisi baru untuk surat ${selectedEntry.nomor_full}: ${disposisiNote}`,
          `/apps/persuratan?tab=persuratan_surat_masuk&suratId=${selectedEntry.surat_id}`
        );
      }

      toast.success('Disposisi berhasil dikirim');
      setShowDisposisiModal(false);
      setDisposisiNote('');
      setTagUserId('');
    } catch (err) {
      console.error('Disposition error details:', err);
      toast.error(`Gagal mengirim disposisi: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAmbilNomor = async () => {
    if (!formData.perihal || !formData.tujuan) {
      toast.error('Harap isi perihal dan tujuan');
      return;
    }

    setIsSubmitting(true);
    try {
      let fileId = editingEntry?.file_data || '';
      
      if (file) {
        setUploadProgress(0);
        fileId = await uploadFile(file, (progress) => {
          setUploadProgress(progress);
        });
      }

      if (editingEntry) {
        await updateDoc(doc(db, 'buku_kendali', editingEntry.id), {
          kode_klasifikasi: formData.kode_klasifikasi,
          perihal: formData.perihal,
          tujuan: formData.tujuan,
          pimpinan_id: formData.pimpinan_id,
          tanggal: formData.tanggal,
          file_data: fileId
        });
        toast.success('Entry berhasil diperbarui');
      } else {
        await runTransaction(db, async (transaction) => {
          // Use year from the form date for the counter
          const yearFromForm = new Date(formData.tanggal).getFullYear();
          const counterId = `surat_${activeType}_${yearFromForm}`;
          const counterRef = doc(db, 'counters', counterId);
          const counterDoc = await transaction.get(counterRef);
          
          let nextNumber = 1;
          if (counterDoc.exists()) {
            nextNumber = counterDoc.data().current + 1;
          }

          const now = new Date(formData.tanggal);
          const romanMonth = toRoman(now.getMonth() + 1);
          const year = now.getFullYear();
          const fullNumber = `${nextNumber}/${formData.kode_klasifikasi}/${romanMonth}/${year}`;
          const customNumber = `${formData.custom_text || nextNumber}/${formData.kode_klasifikasi}/${romanMonth}/${year}`;

          const pimpinan = pimpinanList.find(p => p.id === formData.pimpinan_id);

          const newEntryRef = doc(collection(db, 'buku_kendali'));
          const newSuratRef = doc(collection(db, 'surat'));

          const entryData = {
            nomor_urut: nextNumber,
            nomor_full: customNumber,
            nomor_dokumen: customNumber, // Default to full number if not linked to a document yet
            kode_klasifikasi: formData.kode_klasifikasi,
            perihal: formData.perihal,
            tujuan: formData.tujuan,
            petugas: user.name,
            pimpinan: pimpinan?.nama || '',
            pimpinan_id: formData.pimpinan_id,
            status: 'Draft',
            type: activeType,
            tanggal: formData.tanggal,
            file_data: fileId,
            source: 'manual', // Distinguish manual entry from AI
            createdAt: serverTimestamp(),
            surat_id: newSuratRef.id
          };

          transaction.set(newEntryRef, entryData);

          // Create corresponding surat entry
          const suratData = {
            nomor: customNumber,
            nomor_dokumen: customNumber,
            klasifikasi: formData.kode_klasifikasi,
            perihal: formData.perihal,
            tujuan: activeType === 'keluar' ? formData.tujuan : '',
            pengirim: activeType === 'masuk' ? formData.tujuan : '',
            tanggal: formData.tanggal,
            file_data: fileId,
            type: activeType,
            status: 'pending',
            createdBy: user.id,
            authorName: user.name,
            createdAt: serverTimestamp(),
            buku_nomor_id: newEntryRef.id,
            source: 'manual', // Distinguish manual entry from AI
            pimpinan_id: formData.pimpinan_id || ''
          };

          transaction.set(newSuratRef, suratData);

          transaction.set(counterRef, { current: nextNumber }, { merge: true });
        });
        toast.success('Nomor surat berhasil diambil');
      }
      setShowAddModal(false);
      setEditingEntry(null);
      setFile(null);
      setUploadProgress(0);
      setFormData({ 
        kode_klasifikasi: 'HK', 
        perihal: '', 
        tujuan: '', 
        pimpinan_id: '',
        tanggal: new Date().toISOString().split('T')[0],
        custom_text: ''
      });
    } catch (err) {
      console.error(err);
      toast.error('Gagal memproses nomor surat');
    } finally {
      setIsSubmitting(false);
    }
  };

  const startCamera = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast.error('Browser Anda tidak mendukung akses kamera.');
      return;
    }

    try {
      setShowCamera(true);
      setTimeout(async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
              facingMode: 'environment',
              width: { ideal: 1920 },
              height: { ideal: 1080 }
            } 
          });
          
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.onloadedmetadata = () => {
              videoRef.current?.play().catch(e => console.error('Video play error:', e));
            };
          }
        } catch (e) {
          console.warn('Failed to get environment camera, falling back to default:', e);
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            if (videoRef.current) {
              videoRef.current.srcObject = stream;
              videoRef.current.onloadedmetadata = () => {
                videoRef.current?.play().catch(e => console.error('Video play error:', e));
              };
            }
          } catch (err) {
            console.error('Final camera error:', err);
            toast.error('Gagal mengakses kamera. Pastikan izin kamera diberikan.');
            setShowCamera(false);
          }
        }
      }, 300);
    } catch (err) {
      console.error(err);
      toast.error('Gagal menginisialisasi kamera.');
      setShowCamera(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      const maxDim = 1200;
      let width = video.videoWidth;
      let height = video.videoHeight;
      
      if (width > height) {
        if (width > maxDim) {
          height *= maxDim / width;
          width = maxDim;
        }
      } else {
        if (height > maxDim) {
          width *= maxDim / height;
          height = maxDim;
        }
      }
      
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, width, height);
        
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        
        const contrast = 1.2;
        for (let i = 0; i < data.length; i += 4) {
          data[i] = Math.max(0, Math.min(255, (data[i] - 128) * contrast + 128));
          data[i + 1] = Math.max(0, Math.min(255, (data[i + 1] - 128) * contrast + 128));
          data[i + 2] = Math.max(0, Math.min(255, (data[i + 2] - 128) * contrast + 128));
        }
        ctx.putImageData(imageData, 0, 0);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setCapturedImages(prev => [...prev, dataUrl]);
        toast.success(`Foto ke-${capturedImages.length + 1} berhasil diambil`);
      }
    }
  };

  const mergeAndSavePhotos = async () => {
    if (capturedImages.length === 0) return;
    setIsMerging(true);
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      for (let i = 0; i < capturedImages.length; i++) {
        const imgData = capturedImages[i];
        if (i > 0) pdf.addPage();
        
        const img = await new Promise<HTMLImageElement>((resolve) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.src = imgData;
        });

        const imgWidth = img.width;
        const imgHeight = img.height;
        const ratio = Math.min(pageWidth / imgWidth, pageHeight / imgHeight);
        const width = imgWidth * ratio;
        const height = imgHeight * ratio;
        const x = (pageWidth - width) / 2;
        const y = (pageHeight - height) / 2;

        pdf.addImage(imgData, 'JPEG', x, y, width, height);
      }

      const pdfBlob = pdf.output('blob');
      const pdfFile = new File([pdfBlob], `scan_${Date.now()}.pdf`, { type: 'application/pdf' });
      
      setFile(pdfFile);
      stopCamera();
      setCapturedImages([]);
      toast.success('Foto berhasil digabung menjadi PDF');
    } catch (err) {
      console.error(err);
      toast.error('Gagal membuat PDF dari foto');
    } finally {
      setIsMerging(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.size > 5 * 1024 * 1024) {
        toast.error('Ukuran file terlalu besar. Maksimal 5MB.');
        return;
      }
      setFile(selectedFile);
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
      tanggal: entry.tanggal,
      custom_text: '' // Or extract from entry if stored there
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

    const matchesYear = selectedYear === 'all' || entryDate.getFullYear().toString() === selectedYear;
    const matchesMonth = selectedMonth === 'all' || (entryDate.getMonth() + 1).toString() === selectedMonth;
    
    return matchesType && matchesSearch && matchesFilter && matchesYear && matchesMonth;
  });

  const years = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - i).toString());
  const months = [
    { value: '1', label: 'Januari' },
    { value: '2', label: 'Februari' },
    { value: '3', label: 'Maret' },
    { value: '4', label: 'April' },
    { value: '5', label: 'Mei' },
    { value: '6', label: 'Juni' },
    { value: '7', label: 'Juli' },
    { value: '8', label: 'Agustus' },
    { value: '9', label: 'September' },
    { value: '10', label: 'Oktober' },
    { value: '11', label: 'November' },
    { value: '12', label: 'Desember' },
  ];

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
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input 
            placeholder="Cari nomor atau perihal..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl outline-none focus:border-emerald-500 shadow-sm"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-2 px-4 py-3 bg-white border border-slate-200 rounded-2xl font-bold text-slate-600 shadow-sm">
            <Calendar className="w-5 h-5 text-slate-400" />
            <select 
              className="bg-transparent outline-none text-sm"
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
            >
              <option value="all">Semua Tahun</option>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2 px-4 py-3 bg-white border border-slate-200 rounded-2xl font-bold text-slate-600 shadow-sm">
            <Filter className="w-5 h-5 text-slate-400" />
            <select 
              className="bg-transparent outline-none text-sm"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            >
              <option value="all">Semua Bulan</option>
              {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2 px-4 py-3 bg-white border border-slate-200 rounded-2xl font-bold text-slate-600 shadow-sm">
            <Clock className="w-5 h-5 text-slate-400" />
            <select 
              className="bg-transparent outline-none text-sm"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">Semua Waktu</option>
              <option value="today">Hari Ini</option>
              <option value="7days">7 Hari Terakhir</option>
              <option value="month">Bulan Ini</option>
              <option value="year">Tahun Ini</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">
              <tr>
                <th className="px-6 py-5">Nomor Urut</th>
                <th className="px-6 py-5">Nomor Dokumen</th>
                <th className="px-6 py-5">Klasifikasi</th>
                <th className="px-6 py-5">Tanggal</th>
                <th className="px-6 py-5">Perihal</th>
                <th className="px-6 py-5">Tujuan/Pengirim</th>
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
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{entry.type}</span>
                        {(entry as any).source === 'ai' ? (
                          <span className="flex items-center gap-0.5 px-1 bg-emerald-100 text-emerald-700 rounded text-[8px] font-bold uppercase tracking-wider">
                            <Sparkles className="w-2 h-2" /> AI
                          </span>
                        ) : (
                          <span className="flex items-center gap-0.5 px-1 bg-slate-100 text-slate-600 rounded text-[8px] font-bold uppercase tracking-wider">
                            Manual
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-mono font-bold text-emerald-600 whitespace-nowrap bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100">{entry.nomor_full || '-'}</span>
                      <span className="text-[10px] text-slate-400 font-bold">Dok: {entry.nomor_dokumen || '-'}</span>
                    </div>
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
                    <p className="text-sm font-bold text-slate-800 leading-snug line-clamp-2">{entry.perihal}</p>
                  </td>
                  <td className="px-6 py-5">
                    <p className="text-xs font-bold text-slate-600 bg-blue-50 text-blue-700 px-2 py-1 rounded-md inline-block max-w-[150px] truncate">{entry.tujuan}</p>
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
                    <div className="relative group/menu inline-block">
                      <button className="p-2.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl transition-all shadow-sm flex items-center gap-2">
                        <Settings className="w-4 h-4" />
                        <span className="text-xs font-bold">Opsi</span>
                      </button>
                      
                      <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-10 opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all transform origin-top-right scale-95 group-hover/menu:scale-100">
                        <button 
                          onClick={() => { setSelectedEntry(entry); setShowDetailEntryModal(true); }}
                          className="w-full px-4 py-2 text-left text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3"
                        >
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                          Detail Entry
                        </button>
                        {entry.file_data && (
                          <button 
                            onClick={() => setSelectedFileForPreview(entry.file_data || null)}
                            className="w-full px-4 py-2 text-left text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3"
                          >
                            <Eye className="w-4 h-4 text-slate-400" />
                            Lihat Dokumen
                          </button>
                        )}
                        {(user.role === 'admin' || user.persuratan_role === 'petugas') && (
                          <>
                            <div className="h-px bg-slate-100 my-1" />
                            <button 
                              onClick={() => {
                                setSelectedEntry(entry);
                                setShowDisposisiModal(true);
                              }}
                              className="w-full px-4 py-2 text-left text-xs font-bold text-emerald-600 hover:bg-emerald-50 flex items-center gap-3"
                            >
                              <MessageSquare className="w-4 h-4" />
                              Disposisi
                            </button>
                            <button 
                              onClick={() => handleEdit(entry)}
                              className="w-full px-4 py-2 text-left text-xs font-bold text-blue-600 hover:bg-blue-50 flex items-center gap-3"
                            >
                              <Edit2 className="w-4 h-4" />
                              Edit Data
                            </button>
                            <button 
                              onClick={() => handleDelete(entry.id)}
                              className="w-full px-4 py-2 text-left text-xs font-bold text-red-600 hover:bg-red-50 flex items-center gap-3"
                            >
                              <Trash2 className="w-4 h-4" />
                              Hapus Entry
                            </button>
                          </>
                        )}
                      </div>
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
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Kustom Teks Nomor (Opsional)</label>
                <input 
                  value={formData.custom_text}
                  onChange={e => setFormData({...formData, custom_text: e.target.value})}
                  placeholder="Contoh: 1A (jika ingin mengubah angka awal)"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm outline-none focus:border-emerald-500"
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

              {/* File Upload & Camera Section */}
              <div className="space-y-3 pt-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Lampiran Dokumen (Opsional)</label>
                
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className={clsx(
                      "flex items-center justify-center gap-2 p-4 rounded-2xl border-2 border-dashed transition-all",
                      file ? "bg-emerald-50 border-emerald-200 text-emerald-600" : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
                    )}
                  >
                    <Upload className="w-5 h-5" />
                    <span className="text-xs font-bold">{file ? 'File Terpilih' : 'Upload File'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={startCamera}
                    className="flex items-center justify-center gap-2 p-4 rounded-2xl border-2 border-dashed bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 transition-all"
                  >
                    <Camera className="w-5 h-5" />
                    <span className="text-xs font-bold">Ambil Foto</span>
                  </button>
                </div>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  className="hidden"
                  accept="image/*,application/pdf"
                />

                {file && (
                  <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                    <div className="flex items-center gap-2">
                      <FileCheck className="w-4 h-4 text-emerald-600" />
                      <span className="text-xs font-bold text-emerald-700 truncate max-w-[200px]">{file.name}</span>
                      <button 
                        onClick={() => handlePreview(file)}
                        className="text-emerald-600 hover:text-emerald-800 p-1"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                    <button 
                      onClick={() => setFile(null)}
                      className="p-1 hover:bg-emerald-100 rounded-full text-emerald-600"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {uploadProgress > 0 && uploadProgress < 100 && (
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="bg-emerald-500 h-full transition-all duration-300" 
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                )}
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
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900">Detail Nomor Buku</h3>
                    {(selectedEntry as any).source === 'ai' ? (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-bold uppercase tracking-wider">
                        <Sparkles className="w-3 h-3" /> AI
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-[10px] font-bold uppercase tracking-wider">
                        Manual
                      </span>
                    )}
                  </div>
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
                  <button 
                    onClick={() => handlePreview(selectedEntry.file_data || '')}
                    disabled={isPreviewLoading}
                    className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-100 disabled:opacity-50"
                  >
                    {isPreviewLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                    {isPreviewLoading ? 'Memuat...' : 'Buka Dokumen Terkait'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Disposisi Modal */}
      {showDisposisiModal && selectedEntry && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-900">Disposisi Nomor Buku</h3>
                <p className="text-xs text-slate-500">{selectedEntry.nomor_full}</p>
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
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Teruskan Ke</label>
                <div className="relative">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <select 
                    value={tagUserId}
                    onChange={e => setTagUserId(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-emerald-500 appearance-none font-bold"
                  >
                    <option value="">Pilih Petugas / Pimpinan...</option>
                    {availableUsers.map(u => (
                      <option key={u.id} value={u.id}>{u.name} ({u.persuratan_role})</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-50 flex gap-3">
              <button 
                onClick={() => setShowDisposisiModal(false)}
                className="flex-1 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Batal
              </button>
              <button 
                onClick={handleDisposisi}
                disabled={isSubmitting}
                className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 disabled:opacity-50"
              >
                {isSubmitting ? 'Mengirim...' : 'Kirim Disposisi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* File Preview Modal */}
      {selectedFileForPreview && (
        <div className="fixed inset-0 bg-black/90 z-[600] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-5xl h-[90vh] rounded-3xl overflow-hidden flex flex-col shadow-2xl">
            <div className="p-4 border-b flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 rounded-xl">
                  <FileText className="w-5 h-5 text-emerald-600" />
                </div>
                <h3 className="font-bold text-slate-900">Pratinjau Dokumen</h3>
              </div>
              <div className="flex items-center gap-2">
                <a 
                  href={selectedFileForPreview} 
                  download={`dokumen_${Date.now()}.pdf`}
                  className="p-2 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-full transition-colors flex items-center justify-center"
                  title="Download File"
                >
                  <Download className="w-5 h-5" />
                </a>
                <button onClick={() => setSelectedFileForPreview(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                  <XCircle className="w-6 h-6 text-slate-500" />
                </button>
              </div>
            </div>
            <div className="flex-1 bg-slate-100 relative overflow-hidden">
              {selectedFileForPreview.startsWith('data:application/pdf') || selectedFileForPreview.toLowerCase().includes('.pdf') ? (
                <iframe src={selectedFileForPreview} className="w-full h-full border-none" title="Preview PDF" />
              ) : (
                <div className="w-full h-full flex items-center justify-center p-4 overflow-auto">
                  <img 
                    src={selectedFileForPreview} 
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

      {/* Camera Modal */}
      {showCamera && createPortal(
        <div className="fixed inset-0 bg-black z-[1000] flex flex-col">
          <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center bg-gradient-to-b from-black/60 to-transparent z-10">
            <div className="text-white">
              <h3 className="font-bold text-lg">Ambil Foto Dokumen</h3>
              <p className="text-xs opacity-80">Posisikan dokumen di tengah frame</p>
            </div>
            <button 
              onClick={stopCamera}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
            >
              <XCircle className="w-8 h-8" />
            </button>
          </div>

          <div className="flex-1 relative bg-slate-900 flex items-center justify-center overflow-hidden">
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              className="w-full h-full object-cover"
            />
            <canvas ref={canvasRef} className="hidden" />
            
            {/* Scan Overlay */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-[85%] h-[70%] border-2 border-white/30 rounded-3xl relative">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-emerald-500 rounded-tl-lg" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-emerald-500 rounded-tr-lg" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-emerald-500 rounded-bl-lg" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-emerald-500 rounded-br-lg" />
                
                {/* Scanning Line Animation */}
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.5)] animate-scan" />
              </div>
            </div>
          </div>

          <div className="p-6 bg-black flex flex-col gap-4">
            {capturedImages.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {capturedImages.map((img, idx) => (
                  <div key={idx} className="relative flex-shrink-0">
                    <img src={img} alt={`Capture ${idx}`} className="w-16 h-20 object-cover rounded-lg border border-white/20" />
                    <button 
                      onClick={() => setCapturedImages(prev => prev.filter((_, i) => i !== idx))}
                      className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5"
                    >
                      <XCircle className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 text-white/60 text-xs font-bold">
                {capturedImages.length} Foto Diambil
              </div>
              
              <button 
                onClick={capturePhoto}
                className="w-20 h-20 bg-white rounded-full p-1 shadow-xl active:scale-95 transition-transform"
              >
                <div className="w-full h-full rounded-full border-4 border-slate-900 flex items-center justify-center">
                  <div className="w-14 h-14 bg-emerald-500 rounded-full" />
                </div>
              </button>

              <div className="flex-1 flex justify-end">
                {capturedImages.length > 0 && (
                  <button 
                    onClick={mergeAndSavePhotos}
                    disabled={isMerging}
                    className="bg-emerald-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-emerald-700 transition-all disabled:opacity-50"
                  >
                    {isMerging ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileCheck className="w-5 h-5" />}
                    {isMerging ? 'Merging...' : 'Selesai'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
