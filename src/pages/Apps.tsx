import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Vote, ChevronRight, MessageSquare, User, Settings, Image } from 'lucide-react';
import { listenToSettings } from '../lib/db';

export default function Apps() {
  const [electionStatus, setElectionStatus] = useState('not_started');

  useEffect(() => {
    const unsubscribe = listenToSettings((settings) => {
      setElectionStatus(settings.election_status || 'not_started');
    });
    return () => unsubscribe();
  }, []);

  const apps = [
    {
      id: 'election',
      name: 'Pemilihan',
      description: 'Pilih kandidat dan lihat klasemen',
      icon: Vote,
      color: 'bg-blue-500',
      path: '/apps/election',
      showBadge: electionStatus === 'in_progress'
    },
    {
      id: 'messages',
      name: 'Pesan',
      description: 'Obrolan dengan teman',
      icon: MessageSquare,
      color: 'bg-emerald-500',
      path: '/messages',
      showBadge: false
    },
    {
      id: 'profile',
      name: 'Profil',
      description: 'Kelola profil Anda',
      icon: User,
      color: 'bg-indigo-500',
      path: '/profile',
      showBadge: false
    },
    {
      id: 'gallery',
      name: 'Galeri',
      description: 'Lihat foto Anda',
      icon: Image,
      color: 'bg-pink-500',
      path: '/profile?tab=gallery',
      showBadge: false
    },
    {
      id: 'settings',
      name: 'Pengaturan',
      description: 'Kelola akun Anda',
      icon: Settings,
      color: 'bg-slate-500',
      path: '/settings',
      showBadge: false
    }
  ];

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Aplikasi</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {apps.map(app => (
          <Link 
            key={app.id} 
            to={app.path}
            className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-4 hover:shadow-md transition-all hover:border-emerald-200 group"
          >
            <div className={`relative ${app.color} w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-white shadow-inner`}>
              <app.icon className="w-6 h-6" />
              {app.showBadge && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-white"></span>
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-slate-900 text-lg">{app.name}</h3>
              <p className="text-sm text-slate-500 truncate">{app.description}</p>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-emerald-500 transition-colors" />
          </Link>
        ))}
      </div>
    </div>
  );
}
