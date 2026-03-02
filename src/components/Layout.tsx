import { ReactNode } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Home, Users, Trophy, User as UserIcon, LogOut, Search, MessageSquare, Shield } from 'lucide-react';
import { User } from '../types';
import { clsx } from 'clsx';
import RightSidebar from './RightSidebar';
import NotificationBell from './NotificationBell';
import { useState, useEffect } from 'react';

interface LayoutProps {
  children: ReactNode;
  user: User;
  onLogout: () => void;
}

export default function Layout({ children, user, onLogout }: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { icon: Home, label: 'Beranda', to: '/' },
    { icon: Search, label: 'Eksplor', to: '/explore', mobileOnly: true },
    { icon: Users, label: 'Kandidat', to: '/candidates' },
    { icon: Trophy, label: 'Klasemen', to: '/leaderboard' },
    { icon: UserIcon, label: 'Profil', to: '/profile' },
  ];

  if (user.role === 'admin') {
    navItems.push({ icon: Shield, label: 'Admin Panel', to: '/admin' });
  }

  const [unreadMessages, setUnreadMessages] = useState(0);
  const [branding, setBranding] = useState({ name: 'Agen Perubahan', subtitle: 'Aplikasi Pemilihan', icon: 'PA', logo: '' });

  useEffect(() => {
    fetch('/api/settings/general')
      .then(res => res.json())
      .then(data => {
        setBranding({ 
          name: data.appName || 'Agen Perubahan', 
          subtitle: data.appSubtitle || 'Aplikasi Pemilihan',
          icon: data.appIcon || 'PA',
          logo: data.appLogoUrl || ''
        });
      })
      .catch(err => console.error('Failed to fetch branding', err));
  }, []);

  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const res = await fetch(`/api/messages/conversations/${user.id}`);
        const data = await res.json();
        const count = data.reduce((acc: number, conv: any) => acc + conv.unread_count, 0);
        setUnreadMessages(count);
      } catch (err: any) {
        if (err.message !== 'Failed to fetch') {
          console.error('Failed to fetch unread messages', err);
        }
      }
    };

    fetchUnread();
    const interval = setInterval(fetchUnread, 15000);
    return () => clearInterval(interval);
  }, [user.id]);

  const getPageTitle = () => {
    switch (location.pathname) {
      case '/': return 'Beranda';
      case '/explore': return 'Eksplor';
      case '/messages': return 'Pesan';
      case '/candidates': return 'Kandidat';
      case '/leaderboard': return 'Klasemen';
      case '/profile': return 'Profil';
      case '/admin': return 'Admin Panel';
      default: return 'Beranda';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex justify-center">
      {/* Sidebar Navigation */}
      <div className="hidden md:flex flex-col w-64 fixed left-0 top-0 h-screen border-r border-slate-200 bg-white px-6 py-8">
        <div className="flex items-center gap-3 mb-10">
          {branding.logo ? (
            <div className="w-10 h-10 rounded-xl overflow-hidden bg-white border border-slate-100 shrink-0">
              <img src={branding.logo} alt="Logo" className="w-full h-full object-contain" />
            </div>
          ) : (
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shrink-0">
              {branding.icon}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="font-bold text-slate-900 leading-tight truncate">{branding.name}</h1>
            <p className="text-[10px] text-slate-500 truncate">{branding.subtitle}</p>
          </div>
        </div>

        <nav className="flex-1 space-y-2">
          {navItems.filter(item => !item.mobileOnly).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-4 px-4 py-3 rounded-xl transition-colors font-medium relative',
                  isActive
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                )
              }
            >
              <item.icon className="w-6 h-6" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <button
          onClick={onLogout}
          className="flex items-center gap-4 px-4 py-3 rounded-xl text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors font-medium mt-auto"
        >
          <LogOut className="w-6 h-6" />
          Keluar
        </button>
      </div>

      {/* Main Content Area */}
      <div className={clsx(
        "w-full min-h-screen border-r border-l md:border-l-0 border-slate-200 bg-white pb-20 md:pb-0",
        location.pathname.startsWith('/admin') ? "max-w-full md:ml-64" : "max-w-2xl md:ml-64 lg:mr-80"
      )}>
        {/* Header */}
        <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 md:hidden">
            {branding.logo ? (
              <div className="w-8 h-8 rounded-lg overflow-hidden bg-white border border-slate-100 shrink-0">
                <img src={branding.logo} alt="Logo" className="w-full h-full object-contain" />
              </div>
            ) : (
              <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white font-bold shrink-0">
                {branding.icon}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="font-bold text-slate-900 truncate text-sm">{branding.name}</h1>
              <p className="text-[8px] text-slate-500 truncate">{branding.subtitle}</p>
            </div>
          </div>
          
          <div className="hidden md:block">
            <h2 className="font-bold text-xl text-slate-900">{getPageTitle()}</h2>
          </div>

          <div className="flex items-center gap-2">
            <NavLink 
              to="/messages" 
              className={({ isActive }) => 
                clsx(
                  "p-2 rounded-full transition-colors relative",
                  isActive ? "bg-emerald-50 text-emerald-600" : "text-slate-600 hover:bg-slate-100"
                )
              }
            >
              <MessageSquare className="w-5 h-5" />
              {unreadMessages > 0 && (
                <span className="absolute top-1 right-1 bg-emerald-600 text-white text-[8px] font-bold w-4 h-4 rounded-full flex items-center justify-center border-2 border-white">
                  {unreadMessages}
                </span>
              )}
            </NavLink>
            <NotificationBell user={user} />
            <button onClick={onLogout} className="p-2 text-slate-600 hover:bg-slate-100 rounded-full md:hidden">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        {children}
      </div>

      {/* Right Sidebar (Trending/Suggestions) */}
      <RightSidebar user={user} />

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around p-2 z-50 pb-safe shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)]">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              clsx(
                'flex flex-col items-center gap-1 p-2 rounded-xl transition-colors relative',
                isActive ? 'text-emerald-600' : 'text-slate-500 hover:text-slate-900'
              )
            }
          >
            <div className="relative">
              <item.icon className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-medium">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </div>
  );
}
