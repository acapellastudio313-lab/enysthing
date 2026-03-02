/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
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
import { Megaphone, X as CloseIcon } from 'lucide-react';

function GlobalNotification() {
  const [notification, setNotification] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    fetch('/api/settings/notification')
      .then(res => {
        if (!res.ok) throw new Error('Network response was not ok');
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          throw new TypeError("Oops, we haven't got JSON!");
        }
        return res.json();
      })
      .then(data => {
        if (data && data.notification) {
          setNotification(data.notification);
          setVisible(true);
        }
      })
      .catch(err => {
        console.error('Failed to fetch notification:', err);
        // Silent fail for user
      });
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

    let socket: WebSocket | null = null;
    let reconnectTimeout: any;

    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}`;
      console.log('[WS] Connecting to:', wsUrl);
      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        console.log('[WS] Connected');
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('[WS] Message received:', data);
          
          // Don't show notifications for own actions
          if (data.actor && Number(data.actor.id) === Number(user.id)) {
            console.log('[WS] Skipping own action');
            return;
          }

          switch (data.type) {
            case 'post:created':
              toast.info(`Postingan baru dari ${data.post.name}`, {
                description: data.post.content.substring(0, 60) + (data.post.content.length > 60 ? '...' : ''),
                icon: <img src={data.post.avatar} className="w-8 h-8 rounded-full object-cover" />,
                action: {
                  label: 'Lihat',
                  onClick: () => navigate(`/post/${data.post.id}`)
                },
                duration: 8000,
              });
              break;

            case 'post:liked':
              if (Number(data.recipientId) === Number(user.id)) {
                toast.success(`${data.actor.name} menyukai postingan Anda`, {
                  icon: <img src={data.actor.avatar} className="w-8 h-8 rounded-full object-cover" />,
                  action: {
                    label: 'Lihat',
                    onClick: () => navigate(`/post/${data.postId}`)
                  },
                });
              }
              break;

            case 'post:commented':
              if (Number(data.recipientId) === Number(user.id)) {
                toast.message(`${data.actor.name} membalas postingan Anda`, {
                  description: data.content,
                  icon: <img src={data.actor.avatar} className="w-8 h-8 rounded-full object-cover" />,
                  action: {
                    label: 'Lihat',
                    onClick: () => navigate(`/post/${data.postId}`)
                  },
                });
              }
              break;

            case 'message:received':
              if (Number(data.recipientId) === Number(user.id)) {
                toast.message(`Pesan baru dari ${data.sender.name}`, {
                  description: data.content,
                  icon: <img src={data.sender.avatar} className="w-8 h-8 rounded-full object-cover" />,
                  action: {
                    label: 'Buka',
                    onClick: () => navigate('/messages')
                  },
                });
              }
              break;

            case 'vote:cast':
              toast.info(`${data.actor.name} telah memberikan suara`, {
                description: `Memilih: ${data.candidateName}`,
                icon: <img src={data.actor.avatar} className="w-8 h-8 rounded-full object-cover" />,
              });
              break;

            case 'election:status_changed':
              const statusMap: Record<string, string> = {
                'not_started': 'Belum Dimulai',
                'in_progress': 'Sedang Berlangsung',
                'closed': 'Telah Selesai'
              };
              toast.warning(`Status Pemilihan Berubah`, {
                description: `Status saat ini: ${statusMap[data.status] || data.status}`,
                icon: '📢',
                duration: 10000,
              });
              break;

            case 'settings:updated':
              toast.info(`Informasi ${data.section === 'explore' ? 'Pemilihan' : 'Klasemen'} Diperbarui`, {
                description: 'Admin telah memperbarui informasi terbaru.',
                icon: '⚙️',
              });
              break;

            case 'user:register':
              if (data.admins && data.admins.includes(user.id)) {
                toast.info('Pengguna Baru Mendaftar', {
                  description: `${data.user.name} (${data.user.username}) menunggu persetujuan.`,
                  icon: <img src={data.user.avatar} className="w-8 h-8 rounded-full object-cover" />,
                  action: {
                    label: 'Tinjau',
                    onClick: () => navigate('/admin')
                  },
                  duration: 10000,
                });
              }
              break;
          }
        } catch (e) {
          console.error('[WS] Failed to parse message:', e);
        }
      };

      socket.onclose = () => {
        console.log('[WS] Disconnected, reconnecting in 3s...');
        reconnectTimeout = setTimeout(connect, 3000);
      };

      socket.onerror = (err) => {
        console.error('[WS] Error:', err);
        socket?.close();
      };
    };

    connect();

    return () => {
      if (socket) {
        socket.onclose = null;
        socket.close();
      }
      clearTimeout(reconnectTimeout);
    };
  }, [user, navigate]);

  return null;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    const storedUserId = localStorage.getItem('userId');
    if (storedUserId) {
      fetch('/api/users')
        .then(res => res.json())
        .then((users: User[]) => {
          const found = users.find(u => u.id === Number(storedUserId));
          if (found) setUser(found);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  return (
    <BrowserRouter>
      <NotificationHandler user={user} />
      <GlobalNotification />
      <Toaster position="top-right" richColors closeButton />
      <Layout user={user} onLogout={() => setShowLogoutConfirm(true)}>
        <Routes>
          <Route path="/" element={<Home user={user} />} />
          <Route path="/candidates" element={<Candidates user={user} />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/leaderboard" element={<Leaderboard user={user} />} />
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
    </BrowserRouter>
  );
}
