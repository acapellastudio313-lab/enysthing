import React, { useState, useRef, useEffect } from 'react';
import { User, Pimpinan } from '../../types';
import { Camera, Upload, FileText, XCircle, FileCheck, Sparkles, Loader2, Hash, Calendar, User as UserIcon, PenTool } from 'lucide-react';
import SignatureModal from '../../components/SignatureModal';
import { toast } from 'sonner';
import { GoogleGenAI, Type } from '@google/genai';
import { db } from '../../lib/firebase';
import { collection, addDoc, serverTimestamp, doc, runTransaction, getDoc, onSnapshot, query, where } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../../lib/firebase';
import { clsx } from 'clsx';
import { toRoman } from '../../utils';

let aiClient: GoogleGenAI | null = null;

// Inisialisasi Gemini di sisi client harus dilakukan dengan hati-hati.
// Jika GEMINI_API_KEY tidak tersedia di browser, jangan inisialisasi SDK.
function getAi(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('GEMINI_API_KEY tidak tersedia. Fitur AI dinonaktifkan.');
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({ apiKey });
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
  const [uploadProgress, setUploadProgress] = useState(0);
  const [result, setResult] = useState<any>(initialData || null);
  const [pimpinanList, setPimpinanList] = useState<Pimpinan[]>([]);
  const [selectedPimpinanId, setSelectedPimpinanId] = useState(initialData?.pimpinan_id || '');
  const [signature, setSignature] = useState<string | null>(initialData?.signature || null);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = query(collection(db, 'pimpinan'), where('is_active', '==', true));
    const unsubscribe = onSnapshot(q, (snap) => {
      setPimpinanList(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Pimpinan)));
    });
    return () => unsubscribe();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
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
          toast.error(err.message || 'Gagal memproses surat dengan AI');
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
    try {
      let fileUrl = initialData?.file_url || '';
      if (file) {
        const fileRef = ref(storage, `persuratan/${Date.now()}_${file.name}`);
        const uploadTask = uploadBytesResumable(fileRef, file);
        
        fileUrl = await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            uploadTask.cancel();
            reject(new Error('Upload timeout. Silakan coba lagi.'));
          }, 60000); // 60s timeout

          uploadTask.on('state_changed', 
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              setUploadProgress(progress);
            }, 
            (error) => {
              clearTimeout(timeout);
              console.error('Storage Upload Error:', error);
              reject(error);
            }, 
            async () => {
              clearTimeout(timeout);
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              resolve(downloadURL);
            }
          );
        });
      }

      await runTransaction(db, async (transaction) => {
        let fullNumber = result.nomor;
        let bukuId = initialData?.buku_nomor_id;
        let nextNumber = initialData?.nomor_urut;

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
        const bukuData = {
          nomor_urut: nextNumber,
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
          file_url: fileUrl,
          signature: signature,
          updatedAt: serverTimestamp()
        };
        
        if (!bukuId) {
          (bukuData as any).createdAt = serverTimestamp();
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
          file_url: fileUrl,
          type,
          updatedAt: serverTimestamp(),
          buku_nomor_id: bukuId,
          signature: signature
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
      console.error(err);
      toast.error(err.message || 'Gagal menyimpan data');
    } finally {
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
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed border-slate-200 rounded-2xl hover:border-emerald-500 hover:bg-emerald-50 transition-all group"
          >
            <div className="p-4 bg-slate-50 rounded-full group-hover:bg-emerald-100 transition-colors">
              <Camera className="w-8 h-8 text-slate-400 group-hover:text-emerald-600" />
            </div>
            <div className="text-center">
              <span className="block font-bold text-slate-700">Scan Kamera</span>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">Gunakan Mobile/Webcam</span>
            </div>
          </button>
          
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed border-slate-200 rounded-2xl hover:border-emerald-500 hover:bg-emerald-50 transition-all group"
          >
            <div className="p-4 bg-slate-50 rounded-full group-hover:bg-emerald-100 transition-colors">
              <Upload className="w-8 h-8 text-slate-400 group-hover:text-emerald-600" />
            </div>
            <div className="text-center">
              <span className="block font-bold text-slate-700">Unggah File</span>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">PDF, JPG, PNG</span>
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
                <p className="text-[10px] text-slate-500 uppercase font-bold">{(file.size / 1024).toFixed(2)} KB</p>
              </div>
            </div>
            <button onClick={() => { setFile(null); setResult(null); }} className="text-slate-400 hover:text-red-500 transition-colors">
              <XCircle className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

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
            {isSaving && uploadProgress > 0 && uploadProgress < 100 && (
              <div 
                className="absolute bottom-0 left-0 h-1 bg-emerald-500 transition-all duration-300" 
                style={{ width: `${uploadProgress}%` }}
              />
            )}
            <div className="flex items-center gap-3">
              {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileCheck className="w-5 h-5" />}
              <span>{isSaving ? (uploadProgress < 100 ? `Mengunggah... ${Math.round(uploadProgress)}%` : 'Menyimpan...') : isExtracting ? 'Menunggu AI...' : 'Simpan & Teruskan ke Buku Nomor'}</span>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
