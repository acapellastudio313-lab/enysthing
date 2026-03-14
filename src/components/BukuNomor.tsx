import { useState, useEffect } from 'react';
import { User } from '../types';
import { db } from '../lib/firebase';
import { collection, doc, runTransaction, onSnapshot, query, orderBy, serverTimestamp, Timestamp, deleteDoc, updateDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { toRoman } from '../utils';
import { Trash2, Edit2, XCircle } from 'lucide-react';

interface NomorSurat {
  id: string;
  nomor: string;
  tanggal: Timestamp;
  staf: string;
  perihal: string;
  status: 'draft' | 'digunakan' | 'arsip';
}

export default function BukuNomor({ user }: { user: User }) {
  const [nomorList, setNomorList] = useState<NomorSurat[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPerihal, setEditPerihal] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'buku_kendali'), orderBy('tanggal', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setNomorList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as NomorSurat)));
    });
    return () => unsubscribe();
  }, []);

  const ambilNomor = async () => {
    try {
      await runTransaction(db, async (transaction) => {
        const counterRef = doc(db, 'counters', 'persuratan');
        const counterSnap = await transaction.get(counterRef);
        
        if (!counterSnap.exists()) {
          throw new Error('Counter tidak ditemukan');
        }

        const lastNumber = counterSnap.data().lastNumber || 0;
        const newNumber = lastNumber + 1;
        
        const date = new Date();
        const romawiBulan = toRoman(date.getMonth() + 1);
        const tahun = date.getFullYear();
        const nomor = `${String(newNumber).padStart(3, '0')}/HK/${romawiBulan}/${tahun}`;

        transaction.update(counterRef, { lastNumber: newNumber });
        transaction.set(doc(collection(db, 'buku_kendali')), {
          nomor,
          tanggal: serverTimestamp(),
          staf: user.name,
          perihal: '',
          status: 'draft'
        });
      });
      toast.success('Nomor berhasil diambil');
    } catch (err) {
      console.error(err);
      toast.error('Gagal mengambil nomor');
    }
  };

  const deleteNomor = async (id: string) => {
    if (!confirm('Yakin ingin menghapus nomor ini?')) return;
    try {
      await deleteDoc(doc(db, 'buku_kendali', id));
      toast.success('Nomor berhasil dihapus');
    } catch (err) {
      console.error(err);
      toast.error('Gagal menghapus nomor');
    }
  };

  const saveEdit = async (id: string) => {
    try {
      await updateDoc(doc(db, 'buku_kendali', id), { perihal: editPerihal });
      setEditingId(null);
      toast.success('Perihal berhasil diperbarui');
    } catch (err) {
      console.error(err);
      toast.error('Gagal memperbarui perihal');
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-bold text-slate-900">Buku Kendali</h2>
        <button onClick={ambilNomor} className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700">
          Ambil Nomor Baru
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-slate-500 uppercase bg-slate-50">
            <tr>
              <th className="px-4 py-3">Nomor</th>
              <th className="px-4 py-3">Tanggal</th>
              <th className="px-4 py-3">Staf</th>
              <th className="px-4 py-3">Perihal</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {nomorList.map(item => (
              <tr key={item.id} className="border-b border-slate-100">
                <td className="px-4 py-3 font-mono font-bold">{item.nomor}</td>
                <td className="px-4 py-3">{item.tanggal?.toDate().toLocaleDateString()}</td>
                <td className="px-4 py-3">{item.staf}</td>
                <td className="px-4 py-3">
                  {editingId === item.id ? (
                    <input 
                      value={editPerihal}
                      onChange={e => setEditPerihal(e.target.value)}
                      className="border rounded px-2 py-1 w-full"
                    />
                  ) : item.perihal}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${item.status === 'draft' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                    {item.status}
                  </span>
                </td>
                <td className="px-4 py-3 flex gap-2">
                  {editingId === item.id ? (
                    <>
                      <button onClick={() => saveEdit(item.id)} className="text-emerald-600 font-bold">Simpan</button>
                      <button onClick={() => setEditingId(null)} className="text-slate-500">Batal</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => { setEditingId(item.id); setEditPerihal(item.perihal); }} className="text-blue-600 hover:text-blue-800">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => deleteNomor(item.id)} className="text-red-600 hover:text-red-800">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
