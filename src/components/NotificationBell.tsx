import { useState, useEffect, useRef } from 'react';
import { Bell, Heart, MessageCircle, UserPlus } from 'lucide-react';
import { User, Notification } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { clsx } from 'clsx';
import { AnimatePresence, motion } from 'motion/react';

export default function NotificationBell({ user }: { user: User }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = () => {
    fetch(`/api/notifications?userId=${user.id}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch notifications');
        return res.json();
      })
      .then(data => {
        if (Array.isArray(data)) {
          setNotifications(data);
          setUnreadCount(data.filter((n: Notification) => n.is_read === 0).length);
        }
      })
      .catch(err => console.error('Error fetching notifications:', err));
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10000);
    return () => clearInterval(interval);
  }, [user.id]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOpen = () => {
    setIsOpen(!isOpen);
    if (!isOpen && unreadCount > 0) {
      fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      }).then(() => setUnreadCount(0));
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={handleOpen}
        className="p-2 text-slate-600 hover:bg-slate-100 rounded-full relative transition-colors"
      >
        <Bell className="w-6 h-6 md:w-5 md:h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2.5 h-2.5 md:w-2 md:h-2 bg-red-500 rounded-full border-2 border-white"></span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-50 origin-top-right"
          >
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <h3 className="font-bold text-slate-900">Notifikasi</h3>
              {unreadCount > 0 && (
                <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                  {unreadCount} baru
                </span>
              )}
            </div>
            
            <div className="max-h-[60vh] overflow-y-auto overscroll-contain divide-y divide-slate-50">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-slate-500 flex flex-col items-center">
                  <Bell className="w-8 h-8 text-slate-300 mb-3" />
                  <p className="text-sm">Belum ada notifikasi.</p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <Link 
                    to={notification.type === 'register' ? `/admin/users` : `/post/${notification.post_id}`} 
                    key={notification.id} 
                    onClick={() => setIsOpen(false)}
                    className={clsx(
                      "flex gap-3 p-4 hover:bg-slate-50 transition-colors",
                      notification.is_read === 0 && "bg-emerald-50/30"
                    )}
                  >
                    <div className="relative shrink-0">
                      <img src={notification.actor_avatar} alt={notification.actor_name} className="w-10 h-10 rounded-full" />
                      <div className={clsx(
                        "absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center border-2 border-white",
                        notification.type === 'like' ? "bg-pink-500" : notification.type === 'comment' ? "bg-emerald-500" : "bg-blue-500"
                      )}>
                        {notification.type === 'like' && <Heart className="w-2.5 h-2.5 text-white fill-current" />}
                        {notification.type === 'comment' && <MessageCircle className="w-2.5 h-2.5 text-white fill-current" />}
                        {notification.type === 'register' && <UserPlus className="w-2.5 h-2.5 text-white" />}
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-900 leading-snug">
                        <span className="font-bold">{notification.actor_name}</span>
                        {notification.type === 'like' && ' menyukai postingan Anda.'}
                        {notification.type === 'comment' && ' mengomentari postingan Anda.'}
                        {notification.type === 'register' && ' mendaftar sebagai pengguna baru.'}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: id })}
                      </p>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
