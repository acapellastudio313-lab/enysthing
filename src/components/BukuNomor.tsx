import { useState, useEffect } from 'react';
import { User } from '../types';
import { db } from '../lib/firebase';
import { collection, doc, runTransaction, onSnapshot, query, orderBy, serverTimestamp, Timestamp } from 'firebase/firestore';
import { toast } from 'sonner';
import { toRoman } from '../utils';

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
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {nomorList.map(item => (
              <tr key={item.id} className="border-b border-slate-100">
                <td className="px-4 py-3 font-mono font-bold">{item.nomor}</td>
                <td className="px-4 py-3">{item.tanggal?.toDate().toLocaleDateString()}</td>
                <td className="px-4 py-3">{item.staf}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${item.status === 'draft' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                    {item.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
