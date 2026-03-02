import { useState, useEffect } from 'react';
import { User, LeaderboardEntry, ElectionStatus } from '../types';
import { Trophy, Medal, ArrowUpRight, Clock, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';
import { motion } from 'motion/react';

export default function Leaderboard({ user }: { user: User }) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [nonVoters, setNonVoters] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [electionStatus, setElectionStatus] = useState<ElectionStatus>('not_started');
  const [leaderboardSettings, setLeaderboardSettings] = useState({ title: 'Klasemen Sementara', description: 'Pemilihan Agen Perubahan 2024' });
  const [showNonVoters, setShowNonVoters] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/leaderboard').then(res => res.json()),
      fetch('/api/non-voters').then(res => res.json()),
      fetch(`/api/settings/status?t=${Date.now()}`).then(res => res.json()),
      fetch('/api/settings/leaderboard').then(res => res.json())
    ]).then(([leaderboardData, nonVotersData, statusData, settingsData]) => {
      setLeaderboard(leaderboardData);
      setNonVoters(nonVotersData);
      setElectionStatus(statusData.status);
      setLeaderboardSettings(settingsData);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="p-8 text-center text-slate-500">Memuat klasemen...</div>;

  const totalVotes = leaderboard.reduce((acc, curr) => acc + curr.vote_count, 0);

  return (
    <div className="w-full min-h-screen bg-slate-50">
      <div className="p-4 md:p-8 bg-emerald-600 text-white sticky top-0 z-20 shadow-md">
        <div className="flex items-center gap-3 md:gap-4 mb-2">
          <div className="p-2 md:p-3 bg-white/20 rounded-xl md:rounded-2xl backdrop-blur-sm shrink-0">
            <Trophy className="w-5 h-5 md:w-8 md:h-8 text-yellow-300" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg md:text-3xl font-extrabold tracking-tight truncate">{leaderboardSettings.title}</h2>
            <p className="text-emerald-100 text-[10px] md:text-base font-medium truncate opacity-90">{leaderboardSettings.description}</p>
          </div>
        </div>
        
        <div className="mt-3 md:mt-6 flex flex-col gap-3 md:gap-6 bg-emerald-700/50 p-2.5 md:p-4 rounded-xl md:rounded-2xl backdrop-blur-sm border border-emerald-500/30">
          <div className="flex items-center gap-3 md:gap-6">
            <div className="flex-1">
              <p className="text-emerald-200 text-[9px] md:text-sm font-medium uppercase tracking-wider mb-0.5 md:mb-1">Total Suara</p>
              <p className="text-lg md:text-3xl font-bold leading-none">{totalVotes}</p>
            </div>
            <div className="w-px h-6 md:h-12 bg-emerald-500/50"></div>
            <div className="flex-1">
              <p className="text-emerald-200 text-[9px] md:text-sm font-medium uppercase tracking-wider mb-0.5 md:mb-1">Belum Memilih</p>
              <button 
                onClick={() => setShowNonVoters(!showNonVoters)}
                className="text-lg md:text-3xl font-bold leading-none hover:text-yellow-300 transition-colors flex items-center gap-2"
              >
                {nonVoters.length}
                <ArrowUpRight className={clsx("w-4 h-4 transition-transform", showNonVoters && "rotate-90")} />
              </button>
            </div>
            <div className="w-px h-6 md:h-12 bg-emerald-500/50"></div>
            <div className="flex-1">
              <p className="text-emerald-200 text-[9px] md:text-sm font-medium uppercase tracking-wider mb-0.5 md:mb-1">Status</p>
              <p className="text-xs md:text-lg font-bold flex items-center gap-1.5 md:gap-2 leading-none">
                <span className={clsx(
                  "w-1.5 h-1.5 md:w-2 md:h-2 rounded-full",
                  electionStatus === 'in_progress' ? "bg-emerald-400 animate-pulse" :
                  electionStatus === 'closed' ? "bg-red-400" : "bg-slate-400"
                )}></span>
                <span className="truncate">
                  {electionStatus === 'not_started' ? 'Belum Dimulai' :
                   electionStatus === 'in_progress' ? 'Berlangsung' : 'Selesai'}
                </span>
              </p>
            </div>
          </div>

          {showNonVoters && nonVoters.length > 0 && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              className="pt-3 border-t border-emerald-500/30"
            >
              <p className="text-[10px] md:text-xs font-bold text-emerald-200 uppercase tracking-widest mb-2">Daftar Akun Belum Memilih</p>
              <div className="flex flex-wrap gap-2">
                {nonVoters.map(voter => (
                  <div key={voter.id} className="flex items-center gap-1.5 bg-white/10 px-2 py-1 rounded-lg border border-white/5">
                    <img src={voter.avatar} alt={voter.name} className="w-4 h-4 md:w-5 md:h-5 rounded-full object-cover" />
                    <span className="text-[10px] md:text-xs font-medium truncate max-w-[80px] md:max-w-[120px]">{voter.name}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>

      <div className="p-3 md:p-6 max-w-3xl mx-auto">
        <div className="space-y-2.5 md:space-y-4">
          {leaderboard.map((entry, index) => {
            const percentage = totalVotes > 0 ? Math.round((entry.vote_count / totalVotes) * 100) : 0;
            
            return (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -2, scale: 1.002 }}
                transition={{ 
                  delay: index * 0.1,
                  type: 'spring', 
                  stiffness: 400, 
                  damping: 25 
                }}
                key={`${entry.id}-${index}`}
                className={clsx(
                  "bg-white rounded-xl md:rounded-3xl p-3 md:p-6 flex items-center gap-3 md:gap-6 shadow-sm border transition-all hover:shadow-md",
                  index === 0 ? "border-yellow-400 ring-1 ring-yellow-400/50" : "border-slate-200"
                )}
              >
                <div className="flex flex-col items-center justify-center w-7 md:w-12 shrink-0">
                  {index === 0 ? (
                    <Medal className="w-7 h-7 md:w-10 md:h-10 text-yellow-500 drop-shadow-sm" />
                  ) : index === 1 ? (
                    <Medal className="w-6 h-6 md:w-8 md:h-8 text-slate-400" />
                  ) : index === 2 ? (
                    <Medal className="w-6 h-6 md:w-8 md:h-8 text-amber-600" />
                  ) : (
                    <span className="text-base md:text-2xl font-bold text-slate-400">#{index + 1}</span>
                  )}
                </div>

                <img src={entry.avatar} alt={entry.name} className={clsx(
                  "rounded-full border-2 md:border-4 object-cover shrink-0",
                  index === 0 ? "w-12 h-12 md:w-20 md:h-20 border-yellow-100" : "w-10 h-10 md:w-16 md:h-16 border-slate-50"
                )} />

                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start md:items-end mb-1 md:mb-2 gap-2">
                    <div className="min-w-0">
                      <h3 className={clsx(
                        "font-bold truncate leading-tight",
                        index === 0 ? "text-sm md:text-2xl text-slate-900" : "text-xs md:text-xl text-slate-800"
                      )}>{entry.name}</h3>
                      <p className="text-slate-500 text-[9px] md:text-sm truncate">@{entry.username}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={clsx(
                        "font-black tracking-tight leading-none",
                        index === 0 ? "text-lg md:text-3xl text-emerald-600" : "text-base md:text-2xl text-slate-700"
                      )}>
                        {percentage}%
                      </p>
                      <p className="text-[9px] md:text-sm text-slate-500 font-medium">{entry.vote_count} suara</p>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="h-1.5 md:h-3 w-full bg-slate-100 rounded-full overflow-hidden mt-1.5 md:mt-3">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${percentage}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className={clsx(
                        "h-full rounded-full",
                        index === 0 ? "bg-gradient-to-r from-yellow-400 to-yellow-500" :
                        index === 1 ? "bg-gradient-to-r from-slate-400 to-slate-500" :
                        index === 2 ? "bg-gradient-to-r from-amber-600 to-amber-700" :
                        "bg-emerald-500"
                      )}
                    />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
