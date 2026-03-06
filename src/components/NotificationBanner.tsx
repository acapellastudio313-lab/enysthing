import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { listenToSettings } from '../lib/db';

export default function NotificationBanner() {
  const [notification, setNotification] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const unsubscribe = listenToSettings((settings) => {
      if (settings.notification) {
        setNotification(settings.notification);
      }
    });

    return () => unsubscribe();
  }, []);

  if (!notification || !isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        className="bg-emerald-600 text-white px-4 py-2 text-sm font-medium flex justify-between items-center z-50"
      >
        <span className="flex-1 text-center">{notification}</span>
        <button onClick={() => setIsVisible(false)} className="ml-2 hover:bg-emerald-700 rounded-full p-1">
          <X className="w-4 h-4" />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
