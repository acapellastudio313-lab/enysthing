import React, { useState } from 'react';
import { User } from '../../types';
import SuratForm from './SuratForm';
import SuratList from './SuratList';
import { Plus, List } from 'lucide-react';

export default function SuratKeluar({ user, suratId }: { user: User, suratId?: string | null }) {
  const [view, setView] = useState<'list' | 'add'>('list');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Surat Keluar</h2>
          <p className="text-xs text-slate-500">Kelola surat yang dikirim dari instansi</p>
        </div>
        <div className="flex gap-2 bg-white p-1 rounded-xl border border-slate-200">
          <button 
            onClick={() => setView('list')}
            className={`p-2 rounded-lg transition-all ${view === 'list' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}
          >
            <List className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setView('add')}
            className={`p-2 rounded-lg transition-all ${view === 'add' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>

      {view === 'list' ? (
        <SuratList user={user} type="keluar" suratId={suratId} />
      ) : (
        <SuratForm user={user} type="keluar" onSuccess={() => setView('list')} />
      )}
    </div>
  );
}
