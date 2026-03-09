/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Toaster, toast } from 'sonner';
import { User } from './types';
import Layout from './components/Layout';
import Home from './pages/Home';
import Candidates from './pages/Candidates';
import Leaderboard from './pages/Leaderboard';
import Profile from './pages/Profile';
import Explore from './pages/Explore';
import PostDetail from './pages/PostDetail';
import Login from './pages/Login';
import Messages from './pages/Messages';
import AdminDashboard from './pages/AdminDashboard';
import Entertainment from './pages/Entertainment';
import ScrollToTop from './components/ScrollToTop';
import { Megaphone, X as CloseIcon } from 'lucide-react';
import { getUser, listenToSettings, listenToNotifications, initAdmin } from './lib/db';

function GlobalNotification() {
  const [notification, setNotification] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const unsubscribe = listenToSettings((settings) => {
      if (settings.notification) {
        setNotification(settings.notification);
        setVisible(true);
      } else {
        setVisible(false);
      }
    });
    return () => unsubscribe();
  }, []);

  if (!visible || !notification) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[60] w-[90%] max-w-lg">
      <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-2xl flex items-start gap-4 border border-slate-700">
        <div className="bg-emerald-500 p-2 rounded-xl shrink-0">
          <Megaphone className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-1">Pengumuman Global</p>
          <p className="text-sm text-slate-200 leading-relaxed">{notification}</p>
        </div>
        <button onClick={() => setVisible(false)} className="p-1 hover:bg-slate-800 rounded-lg transition-colors text-slate-400">
          <CloseIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function NotificationHandler({ user }: { user: User }) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;

    const unsubscribe = listenToNotifications(user.id.toString(), (notifications) => {
       // In a real app, we'd compare with previous notifications to only show toasts for new ones.
       // For now, we'll just rely on the UI components to show notifications.
    });

    return () => unsubscribe();
  }, [user, navigate]);

  return null;
}

// Force Vercel Sync 2026-03-08
export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    initAdmin().catch(console.error);
    const storedUserId = localStorage.getItem('userId');
    if (storedUserId === 'admin') {
      setUser({
        id: 'admin',
        username: 'admin',
        password: 'admins',
        name: 'Administrator',
        role: 'admin',
        is_approved: 1,
        is_verified: 1,
        avatar: 'https://ui-avatars.com/api/?name=Admin&background=random',
        join_date: new Date().toISOString(),
        bio: 'System Administrator'
      });
      setLoading(false);
    } else if (storedUserId) {
      getUser(storedUserId)
        .then(found => {
          if (found) setUser(found);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);


  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
      <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
      <p className="text-slate-500 font-medium animate-pulse">Menyiapkan Aplikasi...</p>
    </div>
  );

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  return (
    <>
      <ScrollToTop />
      <NotificationHandler user={user} />
      <GlobalNotification />
      <Toaster position="top-right" richColors closeButton />
      <Layout user={user} onLogout={() => setShowLogoutConfirm(true)}>
        <Routes>
          <Route path="/" element={<Home user={user} />} />
          <Route path="/candidates" element={<Candidates user={user} />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/leaderboard" element={<Leaderboard user={user} />} />
          <Route path="/entertainment" element={<Entertainment user={user} />} />
          <Route path="/profile" element={<Profile user={user} onUpdateUser={setUser} />} />
          <Route path="/profile/:userId" element={<Profile user={user} onUpdateUser={setUser} />} />
          <Route path="/messages" element={<Messages user={user} />} />
          <Route path="/admin" element={<AdminDashboard user={user} />} />
          <Route path="/post/:postId" element={<PostDetail user={user} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>

      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-neutral-800 rounded-2xl p-6 w-full max-w-sm">
            <h2 className="text-lg font-bold mb-2">Keluar Akun?</h2>
            <p className="text-sm text-slate-600 dark:text-neutral-300 mb-6">Anda yakin ingin keluar dari akun Anda?</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowLogoutConfirm(false)} className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-neutral-700 font-semibold">Batal</button>
              <button onClick={() => { setUser(null); localStorage.removeItem('userId'); setShowLogoutConfirm(false); }} className="px-4 py-2 rounded-lg bg-red-500 text-white font-semibold">Keluar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
