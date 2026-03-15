import React, { useState, useEffect } from 'react';
import { User } from '../../types';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Mail as MailIcon, 
  Send as SendIcon, 
  ListOrdered, 
  Users, 
  Settings as SettingsIcon,
  ChevronRight,
  Menu,
  X,
  Home
} from 'lucide-react';
import { clsx } from 'clsx';
import PersuratanDashboard from './PersuratanDashboard';
import SuratMasuk from './SuratMasuk';
import SuratKeluar from './SuratKeluar';
import BukuNomor from './BukuNomor';
import PersuratanAdmin from './PersuratanAdmin';

export default function Persuratan({ user }: { user: User }) {
  const navigate = useNavigate();
  const setActiveSubTab = (tab: string, suratId?: string) => {
    setActiveSubTabState(tab);
    if (suratId) {
      setActiveSuratId(suratId);
    }
  };
  const [activeSubTab, setActiveSubTabState] = useState('persuratan_dashboard');
  const [activeSuratId, setActiveSuratId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();

  const menuItems = [
    { id: 'persuratan_dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'petugas', 'pimpinan'] },
    { id: 'persuratan_surat_masuk', label: 'Surat Masuk', icon: MailIcon, roles: ['admin', 'petugas', 'pimpinan'] },
    { id: 'persuratan_surat_keluar', label: 'Surat Keluar', icon: SendIcon, roles: ['admin', 'petugas', 'pimpinan'] },
    { id: 'persuratan_buku_nomor', label: 'Buku Nomor', icon: ListOrdered, roles: ['admin', 'petugas', 'pimpinan'] },
  ];

  if (user.role === 'admin') {
    menuItems.push({ id: 'persuratan_manajemen_user', label: 'Manajemen User', icon: Users, roles: ['admin'] });
  }

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    const suratId = params.get('suratId');
    if (tab && menuItems.some(item => item.id === tab)) {
      setActiveSubTab(tab);
    }
    if (suratId) {
      setActiveSuratId(suratId);
    }
  }, [location.search]);

  const filteredMenu = menuItems.filter(item => {
    if (user.hidden_menus?.includes(item.id)) return false;
    if (user.role === 'admin') return true;
    return item.roles.includes(user.persuratan_role || '');
  });

  const renderContent = () => {
    // If the active tab is hidden, fallback to the first available tab
    if (user.hidden_menus?.includes(activeSubTab)) {
      const firstAvailable = filteredMenu[0]?.id || 'persuratan_dashboard';
      if (firstAvailable !== activeSubTab) {
        setTimeout(() => setActiveSubTab(firstAvailable), 0);
        return null;
      }
    }

    switch (activeSubTab) {
      case 'persuratan_dashboard': return <PersuratanDashboard user={user} onNavigate={setActiveSubTab} />;
      case 'persuratan_surat_masuk': return <SuratMasuk user={user} suratId={activeSuratId} />;
      case 'persuratan_surat_keluar': return <SuratKeluar user={user} suratId={activeSuratId} />;
      case 'persuratan_buku_nomor': return <BukuNomor user={user} />;
      case 'persuratan_manajemen_user': return <PersuratanAdmin user={user} />;
      default: return <PersuratanDashboard user={user} onNavigate={setActiveSubTab} />;
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-screen bg-slate-50 font-sans overflow-hidden">
      {/* Mobile Header */}
      <div className="md:hidden bg-white border-b border-slate-200 p-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/')} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <Home className="w-5 h-5 text-slate-600" />
          </button>
          <h2 className="font-bold text-slate-900">Persuratan</h2>
        </div>
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-slate-600">
          {isSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar Navigation */}
      <div className={clsx(
        "fixed inset-0 z-50 md:relative md:z-0 md:flex flex-col w-72 bg-white border-r border-slate-200 transition-transform duration-300",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <div className="p-6 hidden md:block">
          <button 
            onClick={() => navigate('/')}
            className="mb-6 flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all w-full justify-center"
          >
            <Home className="w-4 h-4" />
            KEMBALI KE BERANDA
          </button>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <MailIcon className="w-6 h-6 text-emerald-600" />
            Persuratan
          </h2>
          <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest font-bold">Management System</p>
        </div>

        <nav className="flex-1 px-4 py-2 space-y-1">
          {filteredMenu.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveSubTab(item.id);
                setIsSidebarOpen(false);
              }}
              className={clsx(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm group",
                activeSubTab === item.id 
                  ? "bg-emerald-600 text-white shadow-lg shadow-emerald-200" 
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              )}
            >
              <item.icon className={clsx("w-5 h-5", activeSubTab === item.id ? "text-white" : "text-slate-400 group-hover:text-slate-600")} />
              {item.label}
              {activeSubTab === item.id && <ChevronRight className="w-4 h-4 ml-auto" />}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="bg-slate-50 rounded-xl p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xs">
              {user.name.charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-900 truncate">{user.name}</p>
              <p className="text-[10px] text-slate-500 capitalize">{user.persuratan_role || 'User'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1600px] mx-auto p-4 md:p-8">
          {renderContent()}
        </div>
      </div>

      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
    </div>
  );
}
