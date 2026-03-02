import { Candidate } from '../types';
import { Trophy } from 'lucide-react';
import { clsx } from 'clsx';

interface LeaderboardContentProps {
  candidates: Candidate[];
}

export default function LeaderboardContent({ candidates }: LeaderboardContentProps) {
  const sortedCandidates = [...candidates].sort((a, b) => (b.vote_count || 0) - (a.vote_count || 0));
  const totalVotes = sortedCandidates.reduce((acc, curr) => acc + (curr.vote_count || 0), 0);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Leaderboard Kandidat</h2>
          <p className="text-sm text-slate-500">Berdasarkan total {totalVotes} suara masuk</p>
        </div>
        <Trophy className="w-6 h-6 text-amber-500" />
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Peringkat</th>
              <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Kandidat</th>
              <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Persentase</th>
              <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Total Suara</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-100">
            {sortedCandidates.map((candidate, index) => {
              const percentage = totalVotes > 0 ? ((candidate.vote_count || 0) / totalVotes) * 100 : 0;
              return (
                <tr key={candidate.id} className={clsx(
                  "hover:bg-slate-50/50 transition-colors",
                  index === 0 ? "bg-amber-50/30" : ""
                )}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className={clsx(
                        "w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm",
                        index === 0 ? "bg-amber-500 text-white shadow-lg shadow-amber-200" :
                        index === 1 ? "bg-slate-400 text-white shadow-lg shadow-slate-200" :
                        index === 2 ? "bg-amber-700 text-white shadow-lg shadow-amber-200" :
                        "bg-slate-100 text-slate-500"
                      )}>
                        {index + 1}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <img className="h-10 w-10 rounded-xl object-cover ring-2 ring-white shadow-sm" src={candidate.avatar} alt={candidate.name} referrerPolicy="no-referrer" />
                      <div className="ml-4">
                        <div className="text-sm font-bold text-slate-900">{candidate.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="w-full max-w-[120px]">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold text-slate-500">{percentage.toFixed(1)}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={clsx(
                            "h-full rounded-full transition-all duration-1000",
                            index === 0 ? "bg-amber-500" : "bg-emerald-500"
                          )}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <span className="text-sm font-bold text-slate-900">{candidate.vote_count || 0}</span>
                    <span className="text-xs text-slate-400 ml-1">Suara</span>
                  </td>
                </tr>
              );
            })}
            {candidates.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center">
                  <div className="flex flex-col items-center">
                    <Trophy className="w-12 h-12 text-slate-200 mb-4" />
                    <p className="text-slate-500 font-medium">Belum ada data suara</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
