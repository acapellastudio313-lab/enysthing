import React, { useState, useRef, useEffect } from 'react';
import { User, Pimpinan } from '../../types';
import { Camera, Upload, FileText, XCircle, FileCheck, Sparkles, Loader2, Hash, Calendar, User as UserIcon, PenTool, Eye, Clock, CheckCircle2, X } from 'lucide-react';
import SignatureModal from '../../components/SignatureModal';
import { toast } from 'sonner';
import { sendNotification } from '../../lib/notifications';
import { GoogleGenAI, Type } from '@google/genai';
import { db } from '../../lib/firebase';
import { collection, addDoc, serverTimestamp, doc, runTransaction, getDoc, onSnapshot, query, where } from 'firebase/firestore';
import { clsx } from 'clsx';
import { toRoman } from '../../utils';

let aiClient: GoogleGenAI | null = null;

// Inisialisasi Gemini di sisi client harus dilakukan dengan hati-hati.
// Jika GEMINI_API_KEY tidak tersedia di browser, jangan inisialisasi SDK.
function getAi(): GoogleGenAI | null {
  // Use VITE_GEMINI_API_KEY or GEMINI_API_KEY for Vite/Vercel production builds
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY;
                 
  if (!apiKey) {
    console.error('DEBUG: API Key tidak ditemukan di import.meta.env!');
    toast.error('Fitur AI tidak tersedia: API Key tidak ditemukan. Pastikan VITE_GEMINI_API_KEY atau GEMINI_API_KEY diatur di Vercel.');
    return null;
  }
  
  if (!aiClient) {
    try {
      aiClient = new GoogleGenAI({ apiKey });
      console.log('DEBUG: AI Client initialized successfully');
    } catch (e) {
      console.error('DEBUG: Error initializing AI Client:', e);
      toast.error('Gagal menginisialisasi AI.');
      return null;
    }
  }
  return aiClient;
}

// Updated Classification Codes based on SK Sekma 627/2023 (Simplified common ones)
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

interface SuratFormProps {
  user: User;
  type: 'masuk' | 'keluar';
  onSuccess: () => void;
  initialData?: any;
}

export default function SuratForm({ user, type, onSuccess, initialData }: SuratFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [isMerging, setIsMerging] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [result, setResult] = useState<any>(initialData || null);
  const [pimpinanList, setPimpinanList] = useState<Pimpinan[]>([]);
  const [selectedPimpinanId, setSelectedPimpinanId] = useState(initialData?.pimpinan_id || '');
  const [signature, setSignature] = useState<string | null>(initialData?.signature || null);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [previewFile, setPreviewFile] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = query(collection(db, 'pimpinan'), where('is_active', '==', true));
    const unsubscribe = onSnapshot(q, (snap) => {
      setPimpinanList(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Pimpinan)));
    });
    return () => unsubscribe();
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setShowCamera(true);
      }
    } catch (err) {
      console.error(err);
      toast.error('Gagal mengakses kamera');
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
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
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
      const images = await Promise.all(capturedImages.map(src => {
        return new Promise<HTMLImageElement>((resolve) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.src = src;
        });
      }));

      const totalHeight = images.reduce((sum, img) => sum + img.height, 0);
      const maxWidth = Math.max(...images.map(img => img.width));

      const canvas = document.createElement('canvas');
      canvas.width = maxWidth;
      canvas.height = totalHeight;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        let currentY = 0;
        images.forEach(img => {
          ctx.drawImage(img, 0, currentY);
          currentY += img.height;
        });

        const mergedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
        
        // Check size
        const sizeInBytes = Math.round((mergedDataUrl.length * 3) / 4);
        if (sizeInBytes > 1536 * 1024) {
          toast.error('Hasil gabungan foto terlalu besar (> 1.5MB). Coba ambil lebih sedikit foto.');
          setIsMerging(false);
          return;
        }

        // Create a File object from the data URL to reuse processFile
        const res = await fetch(mergedDataUrl);
        const blob = await res.blob();
        const mergedFile = new File([blob], `camera_capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
        
        setFile(mergedFile);
        stopCamera();
        setCapturedImages([]);
        
        // Process with AI
        await processFile(mergedFile);
      }
    } catch (err) {
      console.error(err);
      toast.error('Gagal menggabungkan foto');
    } finally {
      setIsMerging(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      
      // Limit to 1.5MB to be safe within Firestore limits (Base64 encoding increases size)
      if (selectedFile.size > 1536 * 1024) {
        toast.error('Ukuran file terlalu besar. Maksimal 1.5MB.');
        return;
      }

      setFile(selectedFile);
      await processFile(selectedFile);
    }
  };

  const processFile = async (file: File) => {
    setIsExtracting(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onloadend = async () => {
        try {
          const base64Data = reader.result as string;
          const ai = getAi();
          if (!ai) {
            throw new Error('Fitur AI tidak tersedia (API Key tidak ditemukan)');
          }
          const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: {
              parts: [
                { text: `Analisis surat ${type} ini: lakukan OCR, ekstrak metadata (nomor, tanggal, pengirim, tujuan, perihal), dan klasifikasikan berdasarkan kode resmi (HK, KP, KU, HM, PL, OT, TI, PT, UM, PS). Berikan dalam format JSON. Jika ini surat keluar, nomor surat mungkin belum ada, biarkan kosong.` },
                { inlineData: { data: base64Data.split(',')[1], mimeType: file.type } }
              ]
            },
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  nomor: { type: Type.STRING },
                  tanggal: { type: Type.STRING },
                  pengirim: { type: Type.STRING },
                  tujuan: { type: Type.STRING },
                  perihal: { type: Type.STRING },
                  klasifikasi: { type: Type.STRING, enum: CLASSIFICATION_CODES.map(c => c.code) },
                  ringkasan: { type: Type.STRING }
                }
              }
            }
          });
          
          if (!response.text) {
            throw new Error('AI returned an empty response');
          }

          const extracted = JSON.parse(response.text);
          // Default date to today if not found
          if (!extracted.tanggal) {
            extracted.tanggal = new Date().toISOString().split('T')[0];
          }
          setResult(extracted);
          toast.success('AI berhasil memproses surat');
        } catch (err: any) {
          console.error('Gemini AI Error:', err);
          toast.error(err.message || 'Gagal memproses surat dengan AI. Silakan isi manual.');
          // Fallback to empty form
          setResult({
            nomor: '',
            tanggal: new Date().toISOString().split('T')[0],
            pengirim: '',
            tujuan: '',
            perihal: '',
            klasifikasi: 'UM',
            ringkasan: ''
          });
        } finally {
          setIsExtracting(false);
        }
      };
    } catch (err) {
      console.error('File Reading Error:', err);
      toast.error('Gagal membaca file');
      setIsExtracting(false);
    }
  };

  const saveLetter = async () => {
    if (!result) return;
    if (type === 'keluar' && !selectedPimpinanId) {
      toast.error('Harap pilih pimpinan penandatangan');
      return;
    }

    setIsSaving(true);
    setUploadProgress(0);
    console.log('DEBUG: Starting saveLetter (Firestore-Only)...');
    try {
      let fileData = initialData?.file_data || '';
      
      if (file) {
        console.log('DEBUG: Converting file to Base64...');
        fileData = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = error => reject(error);
        });
        console.log('DEBUG: File converted to Base64');
      }

      console.log('DEBUG: Starting transaction...');
      await runTransaction(db, async (transaction) => {
        let fullNumber = result.nomor;
        let bukuId = initialData?.buku_nomor_id;
        let nextNumber = initialData?.nomor_urut || 0;

        if (!initialData) {
          const counterId = `surat_${type}_${new Date().getFullYear()}`;
          const counterRef = doc(db, 'counters', counterId);
          const counterSnap = await transaction.get(counterRef);
          
          nextNumber = 1;
          if (counterSnap.exists()) {
            nextNumber = counterSnap.data().current + 1;
          }

          const now = new Date(result.tanggal || new Date());
          const romanMonth = toRoman(now.getMonth() + 1);
          const year = now.getFullYear();
          fullNumber = type === 'keluar' 
            ? `${String(nextNumber).padStart(3, '0')}/${result.klasifikasi}/${romanMonth}/${year}`
            : result.nomor;

          transaction.set(counterRef, { current: nextNumber }, { merge: true });
        }

        const pimpinan = pimpinanList.find(p => p.id === selectedPimpinanId);
        const originalNomor = result.nomor_dokumen || result.nomor;

        // 1. Create/Update Buku Nomor Entry
        const bukuRef = bukuId ? doc(db, 'buku_kendali', bukuId) : doc(collection(db, 'buku_kendali'));
        const bukuData: any = {
          nomor_full: fullNumber,
          nomor_dokumen: originalNomor,
          kode_klasifikasi: result.klasifikasi,
          perihal: result.perihal,
          tujuan: type === 'keluar' ? result.tujuan : (result.pengirim || 'Kantor'),
          petugas: user.name,
          pimpinan: pimpinan?.nama || '',
          pimpinan_id: selectedPimpinanId || '',
          status: 'Digunakan',
          type,
          tanggal: result.tanggal,
          file_data: fileData,
          signature: signature,
          updatedAt: serverTimestamp()
        };
        
        if (!bukuId) {
          bukuData.nomor_urut = nextNumber;
          bukuData.createdAt = serverTimestamp();
          transaction.set(bukuRef, bukuData);
          bukuId = bukuRef.id;
        } else {
          transaction.update(bukuRef, bukuData);
        }

        // 2. Create/Update Surat Entry
        const suratRef = initialData ? doc(db, 'surat', initialData.id) : doc(collection(db, 'surat'));
        const suratData = {
          ...result,
          nomor: fullNumber,
          nomor_dokumen: originalNomor,
          file_data: fileData,
          type,
          updatedAt: serverTimestamp(),
          buku_nomor_id: bukuId,
          signature: signature,
          pimpinan_id: selectedPimpinanId || ''
        };

        if (!initialData) {
          (suratData as any).status = 'pending';
          (suratData as any).createdBy = user.id;
          (suratData as any).authorName = user.name;
          (suratData as any).createdAt = serverTimestamp();
          transaction.set(suratRef, suratData);
        } else {
          transaction.update(suratRef, suratData);
        }
      });

      toast.success(initialData ? 'Surat berhasil diperbarui' : 'Surat dan Nomor berhasil disimpan');
      
      setFile(null);
      if (!initialData) setResult(null);
      onSuccess();
    } catch (err: any) {
      console.error('DEBUG: Error in saveLetter:', err);
      toast.error(err.message || 'Gagal menyimpan data');
    } finally {
      console.log('DEBUG: saveLetter finished');
      setIsSaving(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-500" />
          Input Surat Otomatis (AI)
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <button 
            type="button"
            onClick={startCamera}
            className="flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed border-slate-200 rounded-2xl hover:border-emerald-500 hover:bg-emerald-50 transition-all group"
          >
            <div className="p-4 bg-slate-50 rounded-full group-hover:bg-emerald-100 transition-colors">
              <Camera className="w-8 h-8 text-slate-400 group-hover:text-emerald-600" />
            </div>
            <div className="text-center">
              <span className="block font-bold text-slate-700">Scan Kamera</span>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">Multi-foto (Maks 1.5MB)</span>
            </div>
          </button>
          
          <button 
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed border-slate-200 rounded-2xl hover:border-emerald-500 hover:bg-emerald-50 transition-all group"
          >
            <div className="p-4 bg-slate-50 rounded-full group-hover:bg-emerald-100 transition-colors">
              <Upload className="w-8 h-8 text-slate-400 group-hover:text-emerald-600" />
            </div>
            <div className="text-center">
              <span className="block font-bold text-slate-700">Unggah File</span>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">PDF, JPG, PNG (Maks 1.5MB)</span>
            </div>
          </button>
          <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} accept="image/*,.pdf" />
        </div>

        {isExtracting && (
          <div className="flex items-center justify-center gap-3 p-8 bg-emerald-50 rounded-2xl border border-emerald-100">
            <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
            <p className="text-sm text-emerald-700 font-bold">Sedang mengekstrak informasi dengan AI...</p>
          </div>
        )}

        {file && !isExtracting && (
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-lg border border-slate-200">
                <FileText className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <p className="font-bold text-slate-900 text-sm">{file.name}</p>
                <p className="text-[10px] text-slate-500 uppercase font-bold">{(file.size / 1024).toFixed(2)} KB / 1536 KB</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setPreviewFile(URL.createObjectURL(file))} className="text-emerald-600 hover:text-emerald-700 transition-colors">
                <Eye className="w-5 h-5" />
              </button>
              <button onClick={() => { setFile(null); setResult(null); }} className="text-slate-400 hover:text-red-500 transition-colors">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 bg-black/80 z-[250] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl h-[80vh] rounded-2xl overflow-hidden flex flex-col">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="font-bold">Preview Dokumen</h3>
              <button onClick={() => setPreviewFile(null)} className="p-2 hover:bg-slate-100 rounded-full">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 overflow-auto">
              <iframe src={previewFile} className="w-full h-full" title="Preview" />
            </div>
          </div>
        </div>
      )}

      {result && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm animate-in zoom-in-95 duration-300">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Hasil Ekstraksi AI</h2>
            <div className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-bold uppercase">Akurasi Tinggi</div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1 flex items-center gap-1">
                  <Hash className="w-3 h-3" /> Nomor Surat
                </label>
                <input 
                  value={result.nomor} 
                  onChange={e => setResult({...result, nomor: e.target.value})}
                  placeholder={type === 'keluar' ? 'Akan di-generate otomatis' : 'Nomor surat masuk'}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 font-mono font-bold text-slate-900 outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Tanggal
                </label>
                <input 
                  type="date"
                  value={result.tanggal} 
                  onChange={e => setResult({...result, tanggal: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-slate-900 outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Klasifikasi</label>
                <select 
                  value={result.klasifikasi} 
                  onChange={e => setResult({...result, klasifikasi: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-slate-900 outline-none focus:border-emerald-500 font-bold"
                >
                  {CLASSIFICATION_CODES.map(c => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">{type === 'masuk' ? 'Pengirim' : 'Tujuan'}</label>
                <input 
                  value={type === 'masuk' ? result.pengirim : result.tujuan} 
                  onChange={e => setResult({...result, [type === 'masuk' ? 'pengirim' : 'tujuan']: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-slate-900 outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Perihal</label>
                <textarea 
                  value={result.perihal} 
                  onChange={e => setResult({...result, perihal: e.target.value})}
                  rows={3}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-slate-900 outline-none focus:border-emerald-500 resize-none"
                />
              </div>
              {type === 'keluar' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1 flex items-center gap-1">
                      <UserIcon className="w-3 h-3" /> Pimpinan Penandatangan
                    </label>
                    <select 
                      value={selectedPimpinanId}
                      onChange={e => setSelectedPimpinanId(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-slate-900 outline-none focus:border-emerald-500 font-bold"
                    >
                      <option value="">Pilih Pimpinan...</option>
                      {pimpinanList.map(p => (
                        <option key={p.id} value={p.id}>{p.nama} - {p.jabatan}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Tanda Tangan</label>
                    <button 
                      onClick={() => setShowSignatureModal(true)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-slate-900 outline-none focus:border-emerald-500 flex items-center justify-between"
                    >
                      <span className="flex items-center gap-2 font-bold">
                        <PenTool className="w-4 h-4" /> {signature ? 'Tanda Tangan Tersimpan' : 'Buat/Unggah Tanda Tangan'}
                      </span>
                      {signature && <img src={signature} alt="Signature" className="h-8 object-contain" />}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <SignatureModal 
            isOpen={showSignatureModal} 
            onClose={() => setShowSignatureModal(false)} 
            onSave={(sig) => { setSignature(sig); setShowSignatureModal(false); }}
          />

          <button 
            onClick={saveLetter} 
            disabled={isSaving}
            className="w-full mt-8 py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all flex flex-col items-center justify-center gap-1 shadow-xl shadow-slate-200 disabled:opacity-50 overflow-hidden relative"
          >
            <div className="flex items-center gap-3">
              {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileCheck className="w-5 h-5" />}
              <span>{isSaving ? 'Menyimpan...' : isExtracting ? 'Menunggu AI...' : 'Simpan & Teruskan ke Buku Nomor'}</span>
            </div>
          </button>
        </div>
      )}
      {/* Camera Modal */}
      {showCamera && (
        <div className="fixed inset-0 bg-black z-[300] flex flex-col">
          <div className="p-4 flex justify-between items-center bg-black/50 backdrop-blur-md">
            <div className="text-white">
              <h3 className="font-bold">Kamera Dokumen</h3>
              <p className="text-xs opacity-70">{capturedImages.length} foto diambil</p>
            </div>
            <button 
              onClick={stopCamera}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white"
            >
              <XCircle className="w-6 h-6" />
            </button>
          </div>

          <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              className="w-full h-full object-cover"
            />
            <canvas ref={canvasRef} className="hidden" />
            
            {/* Captured Thumbnails */}
            <div className="absolute bottom-24 left-0 right-0 flex justify-center gap-2 p-4 overflow-x-auto">
              {capturedImages.map((img, i) => (
                <div key={i} className="relative shrink-0">
                  <img src={img} alt={`Capture ${i}`} className="w-16 h-16 object-cover rounded-lg border-2 border-white shadow-lg" />
                  <button 
                    onClick={() => setCapturedImages(prev => prev.filter((_, idx) => idx !== i))}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 shadow-md"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="p-8 bg-black/50 backdrop-blur-md flex items-center justify-around">
            <div className="w-12" /> {/* Spacer */}
            <button 
              onClick={capturePhoto}
              className="w-20 h-20 bg-white rounded-full border-4 border-slate-300 active:scale-95 transition-all flex items-center justify-center"
            >
              <div className="w-16 h-16 bg-white rounded-full border-2 border-slate-900" />
            </button>
            <button 
              onClick={mergeAndSavePhotos}
              disabled={capturedImages.length === 0 || isMerging}
              className="flex flex-col items-center gap-1 text-white disabled:opacity-50"
            >
              <div className="p-3 bg-emerald-600 rounded-full">
                {isMerging ? <Clock className="w-6 h-6 animate-spin" /> : <CheckCircle2 className="w-6 h-6" />}
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest">Selesai</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
