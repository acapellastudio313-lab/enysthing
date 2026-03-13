import React, { useState, useEffect } from 'react';
import { User } from '../../types';
import { 
  Users, 
  Search, 
  Shield, 
  UserCheck, 
  UserX, 
  MoreVertical,
  Mail,
  ShieldCheck,
  ShieldAlert
} from 'lucide-react';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { toast } from 'sonner';
import { clsx } from 'clsx';

export default function PersuratanAdmin({ user }: { user: User }) {
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'users'), (snap) => {
      setUsers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as User)));
    });
    return () => unsubscribe();
  }, []);

  const updateRole = async (userId: string, role: 'petugas' | 'pimpinan' | null) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        persuratan_role: role
      });
      toast.success('Role berhasil diperbarui');
    } catch (err) {
      console.error(err);
      toast.error('Gagal memperbarui role');
    }
  };

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Manajemen User Persuratan</h2>
          <p className="text-xs text-slate-500">Tentukan role dan visibilitas menu untuk setiap user</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input 
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Cari user berdasarkan nama atau username..."
          className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl outline-none focus:border-emerald-500 shadow-sm"
        />
      </div>

      {/* User List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              <tr>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Role Persuratan</th>
                <th className="px-6 py-4">Aksi Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 border border-slate-200">
                        {u.avatar ? <img src={u.avatar} alt="" className="w-full h-full rounded-full object-cover" /> : u.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{u.name}</p>
                        <p className="text-xs text-slate-500">@{u.username}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {u.persuratan_role === 'petugas' && <Shield className="w-4 h-4 text-blue-600" />}
                      {u.persuratan_role === 'pimpinan' && <ShieldCheck className="w-4 h-4 text-purple-600" />}
                      <span className={clsx(
                        "text-xs font-bold capitalize",
                        u.persuratan_role === 'petugas' ? "text-blue-600" : 
                        u.persuratan_role === 'pimpinan' ? "text-purple-600" : 
                        "text-slate-400"
                      )}>
                        {u.persuratan_role || 'Belum Diatur'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => updateRole(u.id, 'petugas')}
                        className={clsx(
                          "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all",
                          u.persuratan_role === 'petugas' ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-600"
                        )}
                      >
                        Petugas
                      </button>
                      <button 
                        onClick={() => updateRole(u.id, 'pimpinan')}
                        className={clsx(
                          "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all",
                          u.persuratan_role === 'pimpinan' ? "bg-purple-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-purple-50 hover:text-purple-600"
                        )}
                      >
                        Pimpinan
                      </button>
                      {u.persuratan_role && (
                        <button 
                          onClick={() => updateRole(u.id, null)}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <UserX className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
