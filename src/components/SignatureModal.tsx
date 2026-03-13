import React, { useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { XCircle, Upload, Eraser, PenTool } from 'lucide-react';

interface SignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (signature: string) => void;
}

export default function SignatureModal({ isOpen, onClose, onSave }: SignatureModalProps) {
  const sigCanvas = useRef<SignatureCanvas>(null);
  const [signatureFile, setSignatureFile] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSave = () => {
    if (signatureFile) {
      onSave(signatureFile);
    } else if (sigCanvas.current && !sigCanvas.current.isEmpty()) {
      onSave(sigCanvas.current.toDataURL());
    } else {
      alert('Silakan buat tanda tangan atau unggah file tanda tangan.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <h3 className="font-bold text-slate-900">Tanda Tangan</h3>
          <button onClick={onClose} className="p-2 hover:bg-white rounded-full transition-colors">
            <XCircle className="w-6 h-6 text-slate-400" />
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          <div className="border-2 border-dashed border-slate-200 rounded-2xl p-2">
            <SignatureCanvas
              ref={sigCanvas}
              penColor='black'
              canvasProps={{ width: 450, height: 200, className: 'sigCanvas' }}
            />
          </div>
          <div className="flex gap-2">
            <button onClick={() => sigCanvas.current?.clear()} className="flex-1 py-2 bg-slate-100 rounded-lg text-sm font-bold text-slate-600 flex items-center justify-center gap-2">
              <Eraser className="w-4 h-4" /> Hapus
            </button>
            <label className="flex-1 py-2 bg-emerald-100 rounded-lg text-sm font-bold text-emerald-700 flex items-center justify-center gap-2 cursor-pointer">
              <Upload className="w-4 h-4" /> Unggah TTE
              <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  const reader = new FileReader();
                  reader.onload = (event) => setSignatureFile(event.target?.result as string);
                  reader.readAsDataURL(e.target.files[0]);
                }
              }} />
            </label>
          </div>
        </div>

        <div className="p-6 bg-slate-50 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-600">Batal</button>
          <button onClick={handleSave} className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold">Simpan</button>
        </div>
      </div>
    </div>
  );
}
