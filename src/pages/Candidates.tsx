import { useState, useEffect, FormEvent } from 'react';
import { User, Candidate, ElectionStatus } from '../types';
import { CheckCircle2, CheckCircle, ChevronRight, Info, Share2, Plus, X, Clock, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'motion/react';

export default function Candidates({ user }: { user: User }) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [myVote, setMyVote] = useState<{ candidate_id: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [voting, setVoting] = useState(false);
  const [electionStatus, setElectionStatus] = useState<ElectionStatus>('not_started');
  const [endDate, setEndDate] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [pageTitle, setPageTitle] = useState('Kandidat Agen Perubahan');
  const [pageDescription, setPageDescription] = useState('Kenali visi dan misi para kandidat sebelum menentukan pilihan Anda.');

  const [candidateLabels, setCandidateLabels] = useState({
    label: 'Agen Perubahan',
    descLabel: 'Visi & Misi'
  });

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      fetch('/api/candidates').then(res => res.json()),
      fetch(`/api/my-vote?userId=${user.id}`).then(res => res.json()),
      fetch(`/api/settings/status?t=${Date.now()}`).then(res => res.json()),
      fetch('/api/settings/candidate_page').then(res => res.json()),
      fetch('/api/settings/general').then(res => res.json())
    ]).then(([candsData, voteData, statusData, pageSettings, generalSettings]) => {
      setCandidates(candsData);
      setMyVote(voteData);
      setElectionStatus(statusData.status);
      setEndDate(statusData.endDate);
      setPageTitle(pageSettings.title);
      setPageDescription(pageSettings.description);
      setCandidateLabels({
        label: generalSettings.candidateLabel || 'Agen Perubahan',
        descLabel: generalSettings.candidateDescLabel || 'Visi & Misi'
      });
      setLoading(false);
    }).catch(err => {
      console.error('Error fetching candidates data:', err);
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchData();

    // WebSocket for real-time updates
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}`);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'election:status_changed') {
        setElectionStatus(data.status);
      } else if (data.type === 'settings:updated' && data.section === 'end_date') {
        setEndDate(data.endDate);
      } else if (data.type === 'vote:cast') {
        // Optional: update counts if needed, but we don't show them here
      }
    };

    return () => ws.close();
  }, [user.id]);

  useEffect(() => {
    if (electionStatus !== 'in_progress' || !endDate) {
      setTimeLeft('');
      return;
    }

    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const end = new Date(endDate).getTime();
      const distance = end - now;

      if (distance <= 0) {
        setTimeLeft('Waktu Habis');
        setElectionStatus('closed');
        return;
      }

      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      let timeStr = '';
      if (days > 0) timeStr += `${days}h `;
      timeStr += `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      setTimeLeft(timeStr);
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [electionStatus, endDate]);

  const handleVote = async (candidateId: number) => {
    if (myVote) return;
    setVoting(true);
    try {
      const res = await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voter_id: user.id, candidate_id: candidateId })
      });
      if (res.ok) {
        setMyVote({ candidate_id: candidateId });
        setSelectedCandidate(null);
      } else {
        const data = await res.json();
        alert(data.error || 'Gagal memberikan suara. Mungkin Anda sudah memilih.');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setVoting(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Memuat kandidat...</div>;

  return (
    <div className="w-full">
      <div className="p-4 md:p-6 border-b border-slate-200 bg-white sticky top-0 z-10 flex flex-col sm:flex-row justify-between items-start gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight">{pageTitle}</h2>
          <p className="text-sm md:text-base text-slate-500 mt-1">{pageDescription}</p>
        </div>
      </div>

      <div className="p-4 md:p-6">
        {/* Election Status Banner */}
        <div className="mb-6 p-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-2xl shadow-md">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              <h2 className="font-bold text-lg">Status Pemilihan</h2>
            </div>
            {endDate && (
              <span className="text-xs bg-white/20 px-3 py-1.5 rounded-full font-medium">
                Batas Waktu: {new Date(endDate).toLocaleDateString('id-ID')} {new Date(endDate).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>

          {electionStatus === 'not_started' && (
            <div className="text-center py-4 bg-white/10 rounded-xl border border-white/20">
              <p className="font-bold text-lg">Pemilihan Belum Dimulai</p>
              <p className="text-sm opacity-80 mt-1">Anda dapat melihat daftar kandidat, namun belum dapat memberikan suara.</p>
            </div>
          )}

          {electionStatus === 'closed' && (
            <div className="text-center py-4 bg-white/10 rounded-xl border border-white/20">
              <p className="font-bold text-lg">Pemilihan Telah Berakhir</p>
              <p className="text-sm opacity-80 mt-1">Sesi pemilihan telah ditutup. Terima kasih atas partisipasi Anda.</p>
            </div>
          )}

          {electionStatus === 'in_progress' && (
            <div className="flex items-center justify-between bg-white/20 rounded-xl p-4 border border-white/10 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-red-400 rounded-full animate-pulse" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider opacity-90">Sisa Waktu Voting</p>
                  <p className="text-2xl font-mono font-bold leading-none mt-1">{timeLeft || '--:--:--'}</p>
                </div>
              </div>
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold uppercase tracking-wider opacity-90">Status</p>
                <p className="text-sm font-bold mt-1">Sedang Berlangsung</p>
              </div>
            </div>
          )}
        </div>

        {myVote && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Terima kasih telah berpartisipasi!</p>
              <p className="text-sm text-emerald-700 mt-1">Anda sudah memberikan suara pada pemilihan ini.</p>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 md:p-6 grid gap-4 md:gap-6">
        {candidates.length > 0 ? candidates.map((candidate) => (
          <motion.div
            layoutId={`candidate-${candidate.id}`}
            key={candidate.id}
            onClick={() => setSelectedCandidate(candidate)}
            whileHover={{ y: -4, scale: 1.005 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className={clsx(
              "bg-white border rounded-2xl p-4 md:p-6 cursor-pointer transition-all hover:shadow-xl",
              myVote?.candidate_id === candidate.id ? "border-emerald-500 ring-1 ring-emerald-500" : "border-slate-200 hover:border-emerald-300"
            )}
          >
            <div className="flex flex-col sm:flex-row items-start gap-3 md:gap-4">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <img src={candidate.avatar} alt={candidate.name} className="w-12 h-12 md:w-16 md:h-16 rounded-full border-2 border-slate-100" />
                <div className="sm:hidden flex-1">
                  <h3 className="font-bold text-base text-slate-900">{candidate.name}</h3>
                  <p className="text-slate-500 text-xs">@{candidate.username}</p>
                </div>
                {myVote?.candidate_id === candidate.id && (
                  <span className="sm:hidden bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Pilihan
                  </span>
                )}
              </div>
              <div className="flex-1 w-full">
                <div className="hidden sm:flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-lg text-slate-900">{candidate.name}</h3>
                    <p className="text-slate-500 text-sm">@{candidate.username}</p>
                  </div>
                  {myVote?.candidate_id === candidate.id && (
                    <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Pilihan Anda
                    </span>
                  )}
                </div>
                
                <div className="mt-2 sm:mt-4">
                  <p className="text-xs md:text-sm font-bold text-slate-900 uppercase tracking-wider mb-1">{candidateLabels.label}</p>
                  <p className="text-sm md:text-base text-slate-700 italic line-clamp-3 sm:line-clamp-none">"{candidate.innovation_program || 'Belum ada program inovasi'}"</p>
                </div>

                <div className="mt-3 sm:mt-4 flex items-center text-emerald-600 font-medium text-xs md:text-sm group">
                  Lihat detail visi & misi <ChevronRight className="w-3 h-3 md:w-4 md:h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </div>
          </motion.div>
        )) : (
          <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 mx-auto mb-4">
              <Plus className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Belum Ada Kandidat</h3>
            <p className="text-slate-500 max-w-xs mx-auto mt-1">Daftar kandidat akan muncul di sini setelah didaftarkan oleh admin.</p>
          </div>
        )}
      </div>

      {/* Modal Detail Kandidat */}
      <AnimatePresence>
        {selectedCandidate && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedCandidate(null)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40"
            />
            <motion.div
              layoutId={`candidate-${selectedCandidate.id}`}
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-x-4 top-[10%] bottom-[10%] md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-lg bg-white rounded-3xl z-50 overflow-hidden shadow-2xl flex flex-col"
            >
              <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-white to-transparent z-10 pointer-events-none rounded-t-3xl" />
              
              <button
                onClick={() => setSelectedCandidate(null)}
                className="absolute top-4 right-4 p-2 bg-slate-100/80 backdrop-blur-sm hover:bg-slate-200 rounded-full text-slate-600 transition-colors z-20 shadow-sm"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="p-6 overflow-y-auto flex-1 relative scrollbar-hide">
                <div className="flex flex-col items-center text-center gap-4 mb-8 mt-4">
                  <div className="relative">
                    <img 
                      src={selectedCandidate.avatar} 
                      alt={selectedCandidate.name} 
                      className="w-24 h-24 md:w-28 md:h-28 rounded-full border-4 border-emerald-50 shadow-lg object-cover" 
                    />
                    <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white p-1.5 rounded-full border-2 border-white">
                      <CheckCircle className="w-4 h-4 fill-current" />
                    </div>
                  </div>
                  <div>
                    <h3 className="font-bold text-2xl md:text-3xl text-slate-900 leading-tight">{selectedCandidate.name}</h3>
                    <p className="text-base text-slate-500 font-medium">@{selectedCandidate.username}</p>
                  </div>
                </div>

                <div className="space-y-6 pb-4">
                  <div className="bg-emerald-50 rounded-2xl p-5 border border-emerald-100 shadow-sm">
                    <h4 className="font-bold text-emerald-900 uppercase tracking-wider text-xs mb-3 flex items-center gap-2">
                      <Info className="w-4 h-4" /> Program Inovasi
                    </h4>
                    <p className="text-emerald-800 font-medium leading-relaxed italic">"{selectedCandidate.innovation_program || 'Belum ada program inovasi'}"</p>
                  </div>

                  {selectedCandidate.image_url && (
                    <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
                      <img src={selectedCandidate.image_url} alt="Campaign" className="w-full h-auto object-cover" />
                    </div>
                  )}

                  <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                    <h4 className="font-bold text-slate-900 uppercase tracking-wider text-xs mb-3">Visi</h4>
                    <div className="prose prose-slate prose-sm max-w-none">
                      <p className="whitespace-pre-wrap text-slate-700 leading-relaxed">{selectedCandidate.vision || 'Belum ada visi'}</p>
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                    <h4 className="font-bold text-slate-900 uppercase tracking-wider text-xs mb-3">Misi</h4>
                    <div className="prose prose-slate prose-sm max-w-none">
                      <p className="whitespace-pre-wrap text-slate-700 leading-relaxed">{selectedCandidate.mission || 'Belum ada misi'}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 md:p-6 bg-white border-t border-slate-100 flex flex-col sm:flex-row gap-3">
                <div className="flex gap-2 flex-1">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/candidates/${selectedCandidate.id}`);
                      alert('Tautan profil kandidat disalin!');
                    }}
                    className="p-3 rounded-xl font-bold text-slate-500 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors flex items-center justify-center"
                    title="Bagikan"
                  >
                    <Share2 className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setSelectedCandidate(null)}
                    className="flex-1 px-4 py-3 rounded-xl font-bold text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors text-sm md:text-base"
                  >
                    Tutup
                  </button>
                </div>
                {!myVote && electionStatus === 'in_progress' && (
                  <button
                    onClick={() => handleVote(selectedCandidate.id)}
                    disabled={voting}
                    className="w-full sm:w-auto sm:flex-[1.5] px-6 py-3 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-all shadow-md shadow-emerald-200 disabled:opacity-50 flex justify-center items-center text-base active:scale-95"
                  >
                    {voting ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Memproses...
                      </div>
                    ) : 'Pilih Kandidat'}
                  </button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
