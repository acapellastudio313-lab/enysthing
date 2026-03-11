import { useState } from 'react';
import { User } from '../types';
import Candidates from './Candidates';
import Leaderboard from './Leaderboard';
import { Users, Trophy } from 'lucide-react';

export default function ElectionApp({ user }: { user: User }) {
  const [activeTab, setActiveTab] = useState<'candidates' | 'leaderboard'>('candidates');

  return (
    <div className="flex flex-col h-full min-h-screen">
      <div className="bg-white border-b border-slate-200">
        <div className="flex px-4 pt-4 gap-4 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('candidates')}
            className={`flex items-center gap-2 pb-3 px-2 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'candidates' 
                ? 'border-emerald-500 text-emerald-600 font-bold' 
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-5 h-5" />
            Kandidat
          </button>
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`flex items-center gap-2 pb-3 px-2 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'leaderboard' 
                ? 'border-emerald-500 text-emerald-600 font-bold' 
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Trophy className="w-5 h-5" />
            Klasemen
          </button>
        </div>
      </div>

      <div className="flex-1">
        {activeTab === 'candidates' ? (
          <Candidates user={user} />
        ) : (
          <Leaderboard user={user} />
        )}
      </div>
    </div>
  );
}
