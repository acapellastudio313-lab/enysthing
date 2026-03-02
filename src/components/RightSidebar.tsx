import { useState, useEffect, useRef } from 'react';
import { Search, TrendingUp, User as UserIcon, MessageSquare, X } from 'lucide-react';
import { LeaderboardEntry } from '../types';
import { NavLink, useNavigate, useLocation, Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';

import Stories from './Stories';

interface SearchResult {
  posts: {
    id: number;
    content: string;
    created_at: string;
    name: string;
    avatar: string;
    username: string;
    author_id: number;
  }[];
  users: {
    id: number;
    name: string;
    username: string;
    avatar: string;
    role: string;
  }[];
}

export default function RightSidebar({ isMobile = false, user }: { isMobile?: boolean, user?: any }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [trending, setTrending] = useState<LeaderboardEntry[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    setQuery('');
    setResults(null);
  }, [location.pathname]);
  const [exploreSettings, setExploreSettings] = useState({
    title: 'Informasi Pemilihan',
    schedule: '1 - 15 November 2024',
    requirement: 'Seluruh Pegawai PA Prabumulih',
    help: 'Hubungi panitia jika mengalami kendala saat melakukan voting.'
  });
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/leaderboard')
      .then(res => res.json())
      .then(data => {
        setTrending(data.slice(0, 3));
      });

    fetch('/api/settings/explore')
      .then(res => res.json())
      .then(data => {
        setExploreSettings(data);
      });
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setResults(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults(null);
      return;
    }

    const timer = setTimeout(() => {
      setIsSearching(true);
      fetch(`/api/search?q=${encodeURIComponent(query)}`)
        .then(res => res.json())
        .then(data => {
          setResults(data);
          setIsSearching(false);
        });
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const clearSearch = () => {
    setQuery('');
    setResults(null);
  };

  return (
    <div className={isMobile ? "w-full px-4 py-6 pb-24" : "hidden lg:block w-80 fixed right-0 top-0 h-screen px-6 py-8 overflow-y-auto"}>
      {user && (
        <div className="mb-6">
          <h3 className="font-bold text-slate-900 mb-3">Snap Story</h3>
          <Stories user={user} />
        </div>
      )}

      <div className="relative mb-6" ref={searchRef}>
        <div className="bg-slate-100 rounded-2xl p-4 flex items-center gap-3 focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:bg-white transition-all border border-transparent focus-within:border-emerald-200">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {
              if (query.trim() && !results) {
                setIsSearching(true);
                fetch(`/api/search?q=${encodeURIComponent(query)}`)
                  .then(res => res.json())
                  .then(data => {
                    setResults(data);
                    setIsSearching(false);
                  });
              }
            }}
            placeholder="Cari kandidat, post, atau akun..."
            className="bg-transparent border-none outline-none text-sm w-full text-slate-900 placeholder:text-slate-400"
          />
          {query && (
            <button onClick={clearSearch} className="p-1 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <AnimatePresence>
          {results && (query.trim().length > 0) && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-50 max-h-[70vh] flex flex-col"
            >
              <div className="overflow-y-auto p-2">
                {isSearching ? (
                  <div className="p-4 text-center text-sm text-slate-500">Mencari...</div>
                ) : (
                  <>
                    {results.users.length === 0 && results.posts.length === 0 ? (
                      <div className="p-4 text-center text-sm text-slate-500">Tidak ada hasil ditemukan.</div>
                    ) : (
                      <>
                        {results.users.length > 0 && (
                          <div className="mb-2">
                            <h3 className="px-3 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider">Akun</h3>
                            {results.users.map(user => (
                              <button
                                key={user.id}
                                onClick={() => {
                                  navigate(`/profile/${user.id}`);
                                  setResults(null);
                                  setQuery('');
                                }}
                                className="w-full flex items-center gap-3 p-2 hover:bg-slate-50 rounded-xl transition-colors text-left"
                              >
                                <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full" />
                                <div className="flex-1 min-w-0">
                                  <p className="font-bold text-sm text-slate-900 truncate">{user.name}</p>
                                  <p className="text-xs text-slate-500 truncate">@{user.username}</p>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                        
                        {results.posts.length > 0 && (
                          <div>
                            <h3 className="px-3 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider">Postingan</h3>
                            {results.posts.map(post => (
                              <button
                                key={post.id}
                                onClick={() => {
                                  navigate(`/post/${post.id}`);
                                  setResults(null);
                                  setQuery('');
                                }}
                                className="w-full flex gap-3 p-2 hover:bg-slate-50 rounded-xl transition-colors text-left"
                              >
                                <div className="mt-1">
                                  <MessageSquare className="w-4 h-4 text-slate-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-slate-900 line-clamp-2 leading-snug">{post.content}</p>
                                  <p className="text-xs text-slate-500 mt-1 truncate">oleh {post.name}</p>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 mb-6">
        <h2 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-emerald-600" />
          Kandidat Terpopuler
        </h2>
        <div className="space-y-4">
          {trending.map((candidate, index) => (
            <Link to="/candidates" key={candidate.id} className="flex items-center gap-3 group">
              <div className="relative">
                <img src={candidate.avatar} alt={candidate.name} className="w-10 h-10 rounded-full" />
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-slate-800 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-slate-50">
                  {index + 1}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-slate-900 truncate group-hover:text-emerald-600 transition-colors">
                  {candidate.name}
                </p>
                <p className="text-xs text-slate-500 truncate">@{candidate.username}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-emerald-600">{candidate.vote_count}</p>
                <p className="text-[10px] text-slate-500 uppercase">Suara</p>
              </div>
            </Link>
          ))}
        </div>
        <Link to="/leaderboard" className="block text-center text-sm text-emerald-600 font-medium mt-4 hover:underline">
          Lihat Klasemen Lengkap
        </Link>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
        <h2 className="font-bold text-slate-900 mb-4">{exploreSettings.title}</h2>
        <div className="space-y-4">
          <div>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Jadwal Voting</p>
            <p className="text-sm text-slate-900 font-medium">{exploreSettings.schedule}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Syarat Pemilih</p>
            <p className="text-sm text-slate-900 font-medium">{exploreSettings.requirement}</p>
          </div>
          <div className="pt-4 border-t border-slate-200">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-2">Pusat Bantuan</p>
            <p className="text-sm text-slate-600">{exploreSettings.help}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
