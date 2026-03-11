import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { User } from '../types';
import { Gamepad2, HelpCircle, RefreshCw, Plus, Trash2, Play, Square, Trophy, CheckCircle, XCircle, Clock, Hash, Users, Settings, ChevronDown, ChevronUp } from 'lucide-react';
import { clsx } from 'clsx';
import { collection, doc, onSnapshot, setDoc, updateDoc, addDoc, getDocs, deleteDoc, serverTimestamp, query, where, orderBy, writeBatch } from 'firebase/firestore';
import { getAllUsers, listenToSettings } from '../lib/db';
import { db } from '../lib/firebase';
import { toast } from 'sonner';

export default function Entertainment({ user }: { user: User }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get('tab') as 'kuis' | 'spin' | 'number') || 'kuis';
  
  const [isQuizActive, setIsQuizActive] = useState(false);
  const [isSpinActive, setIsSpinActive] = useState(false);
  const [isNumberActive, setIsNumberActive] = useState(false);

  useEffect(() => {
    const unsubQuiz = onSnapshot(doc(db, 'entertainment', 'quiz'), (docSnap) => {
      if (docSnap.exists()) {
        setIsQuizActive(docSnap.data().status === 'active');
      }
    });
    const unsubSpin = onSnapshot(doc(db, 'entertainment', 'spin'), (docSnap) => {
      if (docSnap.exists()) {
        setIsSpinActive(docSnap.data().isSpinning === true);
      }
    });
    const unsubNumber = onSnapshot(doc(db, 'entertainment', 'number'), (docSnap) => {
      if (docSnap.exists()) {
        setIsNumberActive(docSnap.data().isGenerating === true);
      }
    });

    return () => {
      unsubQuiz();
      unsubSpin();
      unsubNumber();
    };
  }, []);

  const setActiveTab = (tab: 'kuis' | 'spin' | 'number') => {
    setSearchParams({ tab });
  };

  const isAdminOrMod = user.role === 'admin' || user.role === 'moderator';

  const entertainmentApps = [
    {
      id: 'kuis',
      name: 'Kuis Interaktif',
      description: 'Uji pengetahuanmu',
      icon: HelpCircle,
      color: 'bg-emerald-500',
      path: '/entertainment?tab=kuis',
      showBadge: isQuizActive
    },
    {
      id: 'spin',
      name: 'Putaran Bebas',
      description: 'Coba keberuntunganmu',
      icon: RefreshCw,
      color: 'bg-blue-500',
      path: '/entertainment?tab=spin',
      showBadge: isSpinActive
    },
    {
      id: 'number',
      name: 'Dapatkan Nomor',
      description: 'Dapatkan nomor keberuntungan',
      icon: Hash,
      color: 'bg-amber-500',
      path: '/entertainment?tab=number',
      showBadge: isNumberActive
    }
  ];

  if (activeTab) {
    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto">
        <Link to="/entertainment" className="text-emerald-600 font-bold mb-4 block">&larr; Kembali ke Menu Hiburan</Link>
        {activeTab === 'kuis' ? (
          <QuizSection user={user} isAdminOrMod={isAdminOrMod} />
        ) : activeTab === 'spin' ? (
          <SpinSection user={user} isAdminOrMod={isAdminOrMod} />
        ) : activeTab === 'number' ? (
          <NumberSection user={user} isAdminOrMod={isAdminOrMod} setActiveTab={() => {}} />
        ) : null}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Hiburan</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {entertainmentApps.map(app => (
          <Link 
            key={app.id} 
            to={app.path}
            className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-4 hover:shadow-md transition-all hover:border-emerald-200 group"
          >
            <div className={`relative ${app.color} w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-white shadow-inner`}>
              <app.icon className="w-6 h-6" />
              {app.showBadge && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-white"></span>
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-slate-900 text-lg">{app.name}</h3>
              <p className="text-sm text-slate-500 truncate">{app.description}</p>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-emerald-500 transition-colors" />
          </Link>
        ))}
      </div>
    </div>
  );
}

const DEFAULT_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

// --- NUMBER GENERATOR SECTION ---

interface NumberState {
  currentNumber: string | number | null;
  userNumbers?: Record<string, string | number>;
  isGenerating: boolean;
  lastUpdated: number | null;
  minRange?: number;
  maxRange?: number;
  customNumbers?: Record<string, string | number>;
}

function NumberSection({ user, isAdminOrMod, setActiveTab }: { user: User, isAdminOrMod: boolean, setActiveTab: (tab: 'kuis' | 'spin' | 'number') => void }) {
  const isAdmin = user.role === 'admin';
  const isModerator = user.role === 'moderator';
  
  const [numberState, setNumberState] = useState<NumberState | null>(null);
  const [displayNumber, setDisplayNumber] = useState<string | number | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  
  // Admin UI State
  const [showAllAccounts, setShowAllAccounts] = useState(false);
  const [showRangeSettings, setShowRangeSettings] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [minRange, setMinRange] = useState(1);
  const [maxRange, setMaxRange] = useState(100);
  const [userCustomInputs, setUserCustomInputs] = useState<Record<string, string>>({});

  const [lastAnimatedAt, setLastAnimatedAt] = useState(0);

  useEffect(() => {
    const unsubNumber = onSnapshot(doc(db, 'entertainment', 'number'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as NumberState;
        setNumberState(data);
        
        if (data.minRange !== undefined) setMinRange(data.minRange);
        if (data.maxRange !== undefined) setMaxRange(data.maxRange);
        
        const myNumber = user.role === 'admin' ? null : (data.customNumbers?.[user.id] ?? data.userNumbers?.[user.id] ?? data.currentNumber);

        // Trigger animation if isGenerating is true AND lastUpdated is newer than our last animation
        if (data.isGenerating && data.lastUpdated && data.lastUpdated > lastAnimatedAt) {
          setLastAnimatedAt(data.lastUpdated);
          startAnimation(myNumber, data.minRange || 1, data.maxRange || 100);
        } else if (!data.isGenerating) {
          setDisplayNumber(myNumber);
          setIsAnimating(false);
        }
      } else {
        if (isAdminOrMod) {
          setDoc(doc(db, 'entertainment', 'number'), {
            currentNumber: null,
            isGenerating: false,
            lastUpdated: Date.now(),
            minRange: 1,
            maxRange: 100,
            customNumbers: {}
          });
        }
      }
    });

    return () => unsubNumber();
  }, [isAdminOrMod]);

  useEffect(() => {
    if (isAdminOrMod && showAllAccounts) {
      getAllUsers().then(allUsers => {
        // Filter out admins from the list
        setUsers(allUsers.filter(u => u.role !== 'admin'));
      }).catch(console.error);
    }
  }, [isAdminOrMod, showAllAccounts]);

  const startAnimation = (finalNumber: string | number | null, min: number, max: number) => {
    setIsAnimating(true);
    let count = 0;
    const maxCount = 20;
    const interval = setInterval(() => {
      const range = max - min + 1;
      setDisplayNumber(Math.floor(Math.random() * range) + min);
      
      count++;
      if (count >= maxCount) {
        clearInterval(interval);
        setDisplayNumber(finalNumber);
        setIsAnimating(false);
      }
    }, 100);
  };

  const handleGenerateRandom = async () => {
    const min = numberState?.minRange || 1;
    const max = numberState?.maxRange || 100;
    const range = max - min + 1;
    
    // Get all users to assign unique random numbers (excluding admins)
    const allUsers = (await getAllUsers()).filter(u => u.role !== 'admin');
    const newUserNumbers: Record<string, number> = {};
    
    // Create a shuffled array of numbers in the range
    const availableNumbers = Array.from({ length: Math.min(range, 2000) }, (_, i) => i + min);
    for (let i = availableNumbers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [availableNumbers[i], availableNumbers[j]] = [availableNumbers[j], availableNumbers[i]];
    }
    
    allUsers.forEach((u, index) => {
      // Use unique number from shuffled array, or random if range exceeded
      if (index < availableNumbers.length) {
        newUserNumbers[u.id] = availableNumbers[index];
      } else {
        newUserNumbers[u.id] = Math.floor(Math.random() * range) + min;
      }
    });
    
    await updateDoc(doc(db, 'entertainment', 'number'), {
      userNumbers: newUserNumbers,
      currentNumber: null,
      isGenerating: true,
      lastUpdated: Date.now()
    });

    // Reset generating flag after animation duration
    setTimeout(() => {
      updateDoc(doc(db, 'entertainment', 'number'), { isGenerating: false });
    }, 3000);
  };

  const handleSendToSpin = async () => {
    if (!numberState) return;
    
    const allUsers = (await getAllUsers()).filter(u => u.role !== 'admin');
    const newItems: {id: string, text: string, color: string}[] = [];
    
    allUsers.forEach((u, index) => {
      const num = numberState.customNumbers?.[u.id] ?? numberState.userNumbers?.[u.id];
      if (num !== undefined && num !== null) {
        newItems.push({
          id: Date.now().toString() + index,
          text: `${num} - ${u.name}`,
          color: DEFAULT_COLORS[index % DEFAULT_COLORS.length]
        });
      }
    });
    
    if (newItems.length > 0) {
      localStorage.setItem('pendingSpinItems', JSON.stringify(newItems));
      setActiveTab('spin');
      toast.success('Data berhasil dikirim. Silakan klik Simpan Pengaturan.');
    } else {
      toast.error('Belum ada nomor yang dibagikan');
    }
  };

  const handleUpdateRange = async () => {
    if (minRange >= maxRange) {
      toast.error('Minimal harus lebih kecil dari Maksimal');
      return;
    }
    await updateDoc(doc(db, 'entertainment', 'number'), {
      minRange,
      maxRange,
      lastUpdated: Date.now()
    });
    toast.success('Rentang nomor berhasil diperbarui');
    setShowRangeSettings(false);
  };

  const handleSetUserCustom = async (userId: string, username: string) => {
    const val = userCustomInputs[userId];
    if (val === undefined) return;

    const currentCustoms = numberState?.customNumbers || {};
    const newCustoms = { ...currentCustoms, [userId]: val };

    await updateDoc(doc(db, 'entertainment', 'number'), {
      customNumbers: newCustoms,
      isGenerating: true,
      lastUpdated: Date.now()
    });
    
    // Reset generating flag after animation duration
    setTimeout(() => {
      updateDoc(doc(db, 'entertainment', 'number'), { isGenerating: false });
    }, 3000);

    toast.success(`Nomor custom untuk @${username} berhasil diset`);
  };

  const handleClearUserCustom = async (userId: string, username: string) => {
    const currentCustoms = { ...(numberState?.customNumbers || {}) };
    delete currentCustoms[userId];

    await updateDoc(doc(db, 'entertainment', 'number'), {
      customNumbers: currentCustoms,
      isGenerating: true,
      lastUpdated: Date.now()
    });
    
    // Reset generating flag after animation duration
    setTimeout(() => {
      updateDoc(doc(db, 'entertainment', 'number'), { isGenerating: false });
    }, 3000);
    
    setUserCustomInputs(prev => {
      const next = { ...prev };
      delete next[userId];
      return next;
    });
    
    toast.success(`Nomor custom untuk @${username} dihapus`);
  };

  if (!numberState) return <div className="p-8 text-center text-slate-500">Memuat nomor...</div>;

  return (
    <div className="space-y-6">
      {/* Admin Controls */}
      {isAdminOrMod && (
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900">Kontrol Nomor (Admin)</h3>
            <div className="flex gap-2">
              <button
                onClick={() => setShowRangeSettings(!showRangeSettings)}
                className={clsx(
                  "p-2 rounded-lg transition-colors",
                  showRangeSettings ? "bg-emerald-100 text-emerald-600" : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                )}
                title="Kustom Rentang Nomor"
              >
                <Settings className="w-5 h-5" />
              </button>
              {isAdmin && (
                <button
                  onClick={() => setShowAllAccounts(!showAllAccounts)}
                  className={clsx(
                    "p-2 rounded-lg transition-colors",
                    showAllAccounts ? "bg-emerald-100 text-emerald-600" : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                  )}
                  title="Tampilkan Semua Akun"
                >
                  <Users className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
          
          {/* Range Settings */}
          {showRangeSettings && (
            <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                <Hash className="w-4 h-4" />
                Kustom Rentang Nomor
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-slate-500 font-medium">Minimal</label>
                  <input
                    type="number"
                    value={minRange}
                    onChange={(e) => setMinRange(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-emerald-500 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-500 font-medium">Maksimal</label>
                  <input
                    type="number"
                    value={maxRange}
                    onChange={(e) => setMaxRange(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-emerald-500 outline-none"
                  />
                </div>
              </div>
              <button
                onClick={handleUpdateRange}
                className="w-full py-2 bg-slate-900 text-white rounded-lg text-sm font-bold hover:bg-slate-800 transition-colors"
              >
                Simpan Rentang
              </button>
            </div>
          )}

          {/* User Custom Numbers (Admin Only) */}
          {isAdmin && showAllAccounts && (
            <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3 max-h-[400px] overflow-y-auto animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-700 sticky top-0 bg-white pb-2 border-b border-slate-100">
                <Users className="w-4 h-4" />
                Atur Nomor Per Akun
              </div>
              <div className="space-y-2">
                {users.map(u => (
                  <div key={u.id} className="flex items-center justify-between gap-3 p-2 hover:bg-slate-50 rounded-lg transition-colors">
                    <div className="flex items-center gap-2 min-w-0">
                      <img src={u.avatar || 'https://picsum.photos/seed/avatar/48/48'} alt={u.name} className="w-8 h-8 rounded-full shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">{u.name}</p>
                        <p className="text-[10px] text-slate-500 truncate">@{u.username}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <div className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                        {numberState.customNumbers?.[u.id] ?? numberState.userNumbers?.[u.id] ?? '--'}
                      </div>
                      <input
                        type="text"
                        placeholder="No..."
                        value={userCustomInputs[u.id] ?? (numberState.customNumbers?.[u.id] || '')}
                        onChange={(e) => setUserCustomInputs(prev => ({ ...prev, [u.id]: e.target.value }))}
                        className="w-12 px-2 py-1 border border-slate-200 rounded text-xs focus:border-emerald-500 outline-none"
                      />
                      <button
                        onClick={() => handleSetUserCustom(u.id, u.username)}
                        className="p-1.5 bg-emerald-500 text-white rounded hover:bg-emerald-600 transition-colors"
                        title="Simpan"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                      </button>
                      {numberState.customNumbers?.[u.id] && (
                        <button
                          onClick={() => handleClearUserCustom(u.id, u.username)}
                          className="p-1.5 bg-red-100 text-red-600 rounded hover:bg-red-200 transition-colors"
                          title="Hapus"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {isAdminOrMod && (
            <div className="space-y-2">
              <button
                onClick={handleGenerateRandom}
                disabled={isAnimating || numberState.isGenerating}
                className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <RefreshCw className={clsx("w-5 h-5", (isAnimating || numberState.isGenerating) && "animate-spin")} />
                Berikan Nomor Acak ({numberState.minRange || 1} - {numberState.maxRange || 100})
              </button>
              <button
                onClick={handleSendToSpin}
                disabled={isAnimating || numberState.isGenerating}
                className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Play className="w-5 h-5" />
                Kirim Hasil ke Putaran Bebas
              </button>
            </div>
          )}
        </div>
      )}

      {/* Number Display */}
      <div className="bg-white p-12 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center min-h-[300px]">
        <div className="text-center space-y-4">
          <p className="text-slate-500 font-medium uppercase tracking-widest text-sm">Nomor Anda Saat Ini</p>
          
          <div className={clsx(
            "text-8xl md:text-9xl font-black transition-all duration-300",
            isAnimating ? "text-slate-300 scale-95 blur-sm" : "text-emerald-600 scale-100 blur-0"
          )}>
            {displayNumber !== null ? displayNumber : '--'}
          </div>
          
          {isAnimating && (
            <p className="text-emerald-500 font-bold animate-pulse">Mengacak Nomor...</p>
          )}
          
          {!isAnimating && displayNumber === null && (
            <p className="text-slate-400 italic">Menunggu nomor dari admin...</p>
          )}
        </div>
      </div>
    </div>
  );
}

// --- QUIZ SECTION ---

interface QuizQuestion {
  id: string;
  type: 'multiple_choice' | 'text';
  text: string;
  options?: string[];
  correctAnswer?: string;
  timeLimit: number;
}

interface QuizState {
  status: 'waiting' | 'active' | 'finished';
  currentQuestionIndex: number;
  endTime: number | null;
  questions: QuizQuestion[];
}

interface QuizAnswer {
  id: string;
  userId: string;
  userName: string;
  questionIndex: number;
  answer: string;
  isCorrect?: boolean;
}

function QuizSection({ user, isAdminOrMod }: { user: User, isAdminOrMod: boolean }) {
  const [quizState, setQuizState] = useState<QuizState | null>(null);
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const [userAnswer, setUserAnswer] = useState('');
  const [hasAnswered, setHasAnswered] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editQuestions, setEditQuestions] = useState<QuizQuestion[]>([]);

  useEffect(() => {
    const unsubQuiz = onSnapshot(doc(db, 'entertainment', 'quiz'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as QuizState;
        setQuizState(data);
        if (data.status === 'waiting') {
          setEditQuestions(data.questions || []);
        }
      } else {
        // Initialize if not exists
        if (isAdminOrMod) {
          setDoc(doc(db, 'entertainment', 'quiz'), {
            status: 'waiting',
            currentQuestionIndex: 0,
            endTime: null,
            questions: []
          });
        }
      }
    });

    return () => unsubQuiz();
  }, [isAdminOrMod]);

  useEffect(() => {
    if (quizState?.status === 'active' || quizState?.status === 'finished') {
      const q = query(collection(db, 'entertainment', 'quiz', 'answers'));
      const unsubAnswers = onSnapshot(q, (snapshot) => {
        const ans: QuizAnswer[] = [];
        snapshot.forEach(doc => ans.push({ id: doc.id, ...doc.data() } as QuizAnswer));
        setAnswers(ans);
        
        // Check if current user has answered the current question
        if (quizState.status === 'active') {
          const myAnswer = ans.find(a => a.userId === user.id && a.questionIndex === quizState.currentQuestionIndex);
          setHasAnswered(!!myAnswer);
          if (!myAnswer) setUserAnswer('');
        }
      });
      return () => unsubAnswers();
    }
  }, [quizState?.status, quizState?.currentQuestionIndex, user.id]);

  useEffect(() => {
    if (quizState?.status === 'active' && quizState.endTime) {
      const interval = setInterval(() => {
        const now = Date.now();
        const remaining = Math.max(0, Math.floor((quizState.endTime! - now) / 1000));
        setTimeLeft(remaining);
        
        // Auto-move to next state if time is up
        if (remaining === 0 && isAdminOrMod) {
          // Check if we are already processing a transition to avoid double calls
          // We can check if the current time is significantly past the endTime (e.g. > 2 seconds)
          // to assume it's stuck, but usually just calling handleNextQuestion is fine 
          // because handleNextQuestion updates the DB, which updates quizState, which re-runs this effect.
          
          // To be safe, we can just call it. The function itself relies on current state.
          // We should clear interval immediately to prevent multiple triggers in the same second.
          clearInterval(interval);
          handleNextQuestion();
        }
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setTimeLeft(null);
    }
  }, [quizState?.status, quizState?.endTime, isAdminOrMod, quizState?.currentQuestionIndex]); // Added currentQuestionIndex to dependency

  const handleSaveQuestions = async () => {
    try {
      await updateDoc(doc(db, 'entertainment', 'quiz'), {
        questions: editQuestions
      });
      setIsEditing(false);
      toast.success('Soal kuis berhasil disimpan');
    } catch (err) {
      console.error(err);
      toast.error('Gagal menyimpan soal');
    }
  };

  const handleStartQuiz = async () => {
    if (!quizState?.questions.length) {
      toast.error('Tambahkan soal terlebih dahulu');
      return;
    }
    
    // Clear old answers
    const answersSnap = await getDocs(collection(db, 'entertainment', 'quiz', 'answers'));
    answersSnap.forEach(async (d) => {
      await deleteDoc(doc(db, 'entertainment', 'quiz', 'answers', d.id));
    });

    const firstQ = quizState.questions[0];
    await updateDoc(doc(db, 'entertainment', 'quiz'), {
      status: 'active',
      currentQuestionIndex: 0,
      endTime: Date.now() + (firstQ.timeLimit * 1000)
    });
  };

  const handleNextQuestion = async () => {
    if (!quizState) return;
    const nextIdx = quizState.currentQuestionIndex + 1;
    if (nextIdx < quizState.questions.length) {
      const nextQ = quizState.questions[nextIdx];
      await updateDoc(doc(db, 'entertainment', 'quiz'), {
        currentQuestionIndex: nextIdx,
        endTime: Date.now() + (nextQ.timeLimit * 1000)
      });
    } else {
      await updateDoc(doc(db, 'entertainment', 'quiz'), {
        status: 'finished',
        endTime: null
      });
    }
  };

  const [isResetting, setIsResetting] = useState(false);

  const handleResetQuiz = async () => {
    if (window.confirm('Apakah Anda yakin ingin mereset kuis? Semua soal dan jawaban akan dihapus.')) {
      setIsResetting(true);
      try {
        const batch = writeBatch(db);
        
        // 1. Delete all answers
        const answersSnap = await getDocs(collection(db, 'entertainment', 'quiz', 'answers'));
        answersSnap.docs.forEach((doc) => {
          batch.delete(doc.ref);
        });

        // 2. Reset the main quiz document, clearing questions
        const quizRef = doc(db, 'entertainment', 'quiz');
        batch.set(quizRef, {
          status: 'waiting',
          currentQuestionIndex: 0,
          endTime: null,
          questions: []
        });
        
        await batch.commit();
        
        // 3. Force update local state immediately
        setEditQuestions([]);
        setAnswers([]);
        setQuizState(prev => prev ? ({ ...prev, questions: [], status: 'waiting', currentQuestionIndex: 0, endTime: null }) : null);
        
        toast.success('Kuis berhasil direset sepenuhnya (soal dan jawaban dihapus)');
      } catch (error) {
        console.error('Error resetting quiz:', error);
        toast.error('Gagal mereset kuis');
      } finally {
        setIsResetting(false);
      }
    }
  };

  const handleStopQuiz = async () => {
    await updateDoc(doc(db, 'entertainment', 'quiz'), {
      status: 'waiting',
      currentQuestionIndex: 0,
      endTime: null
    });
  };

  const handleSubmitAnswer = async () => {
    if (!userAnswer.trim() || !quizState || hasAnswered || timeLeft === 0) return;
    
    const currentQ = quizState.questions[quizState.currentQuestionIndex];
    let isCorrect = false;
    
    if (currentQ.type === 'multiple_choice' && currentQ.correctAnswer) {
      isCorrect = userAnswer === currentQ.correctAnswer;
    } else if (currentQ.type === 'text' && currentQ.correctAnswer) {
      isCorrect = userAnswer.toLowerCase().trim() === currentQ.correctAnswer.toLowerCase().trim();
    }

    try {
      await addDoc(collection(db, 'entertainment', 'quiz', 'answers'), {
        userId: user.id,
        userName: user.name,
        questionIndex: quizState.currentQuestionIndex,
        answer: userAnswer,
        isCorrect,
        submittedAt: Date.now()
      });
      setHasAnswered(true);
      toast.success('Jawaban terkirim!');
    } catch (err) {
      console.error(err);
      toast.error('Gagal mengirim jawaban');
    }
  };

  if (!quizState) return <div className="p-8 text-center text-slate-500">Memuat kuis...</div>;

  const currentQ = quizState.questions[quizState.currentQuestionIndex];

  return (
    <div className="space-y-6">
      {/* Admin Controls */}
      {isAdminOrMod && quizState.status === 'waiting' && (
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-900">Pengaturan Kuis (Admin)</h3>
            <div className="flex gap-3">
              <button
                onClick={handleResetQuiz}
                disabled={isResetting}
                className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
              >
                {isResetting ? 'Mereset...' : 'Reset Kuis'}
              </button>
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="text-sm font-medium text-emerald-600 hover:text-emerald-700"
              >
                {isEditing ? 'Batal Edit' : 'Edit Soal'}
              </button>
            </div>
          </div>

          {isEditing ? (
            <div className="space-y-4">
              {editQuestions.map((q, idx) => (
                <div key={q.id} className="p-4 bg-white rounded-xl border border-slate-200 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-sm">Soal {idx + 1}</span>
                    <button onClick={() => setEditQuestions(editQuestions.filter((_, i) => i !== idx))} className="text-red-500 hover:bg-red-50 p-1 rounded-lg">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="Pertanyaan"
                    value={q.text}
                    onChange={(e) => {
                      const newQ = [...editQuestions];
                      newQ[idx].text = e.target.value;
                      setEditQuestions(newQ);
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                  <div className="flex gap-2">
                    <select
                      value={q.type}
                      onChange={(e) => {
                        const newQ = [...editQuestions];
                        newQ[idx].type = e.target.value as any;
                        if (e.target.value === 'text') newQ[idx].options = [];
                        setEditQuestions(newQ);
                      }}
                      className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                    >
                      <option value="multiple_choice">Pilihan Ganda</option>
                      <option value="text">Isian Teks</option>
                    </select>
                    <input
                      type="number"
                      placeholder="Waktu (detik)"
                      value={q.timeLimit}
                      onChange={(e) => {
                        const newQ = [...editQuestions];
                        newQ[idx].timeLimit = parseInt(e.target.value) || 30;
                        setEditQuestions(newQ);
                      }}
                      className="w-24 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                  {q.type === 'multiple_choice' && (
                    <div className="space-y-2 pl-4 border-l-2 border-slate-100">
                      {(q.options || []).map((opt, optIdx) => (
                        <div key={optIdx} className="flex gap-2 items-center">
                          <input
                            type="radio"
                            name={`correct-${q.id}`}
                            checked={q.correctAnswer === opt}
                            onChange={() => {
                              const newQ = [...editQuestions];
                              newQ[idx].correctAnswer = opt;
                              setEditQuestions(newQ);
                            }}
                          />
                          <input
                            type="text"
                            value={opt}
                            onChange={(e) => {
                              const newQ = [...editQuestions];
                              newQ[idx].options![optIdx] = e.target.value;
                              // Update correct answer if it was this option
                              if (newQ[idx].correctAnswer === opt) {
                                newQ[idx].correctAnswer = e.target.value;
                              }
                              setEditQuestions(newQ);
                            }}
                            className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
                          />
                          <button onClick={() => {
                            const newQ = [...editQuestions];
                            newQ[idx].options = newQ[idx].options!.filter((_, i) => i !== optIdx);
                            setEditQuestions(newQ);
                          }} className="text-red-500 p-1">
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => {
                          const newQ = [...editQuestions];
                          if (!newQ[idx].options) newQ[idx].options = [];
                          newQ[idx].options!.push(`Opsi ${newQ[idx].options!.length + 1}`);
                          setEditQuestions(newQ);
                        }}
                        className="text-xs font-medium text-emerald-600 flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" /> Tambah Opsi
                      </button>
                    </div>
                  )}
                  {q.type === 'text' && (
                    <input
                      type="text"
                      placeholder="Jawaban Benar (Opsional)"
                      value={q.correctAnswer || ''}
                      onChange={(e) => {
                        const newQ = [...editQuestions];
                        newQ[idx].correctAnswer = e.target.value;
                        setEditQuestions(newQ);
                      }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-emerald-50"
                    />
                  )}
                </div>
              ))}
              <button
                onClick={() => setEditQuestions([...editQuestions, { id: Date.now().toString(), type: 'multiple_choice', text: '', options: ['A', 'B'], timeLimit: 30 }])}
                className="w-full py-3 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 font-bold hover:bg-slate-50 hover:border-slate-400 transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" /> Tambah Soal
              </button>
              <button
                onClick={handleSaveQuestions}
                className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors"
              >
                Simpan Soal
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">Total Soal: {quizState.questions.length}</p>
              <button
                onClick={handleStartQuiz}
                disabled={quizState.questions.length === 0}
                className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Play className="w-5 h-5" /> Mulai Kuis
              </button>
            </div>
          )}
        </div>
      )}

      {/* Active Quiz View */}
      {quizState.status === 'active' && currentQ && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex justify-between items-center mb-6">
            <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">
              Soal {quizState.currentQuestionIndex + 1} / {quizState.questions.length}
            </span>
            <div className={clsx(
              "flex items-center gap-2 px-3 py-1.5 rounded-full font-bold text-sm",
              (timeLeft || 0) <= 5 ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-600"
            )}>
              <Clock className="w-4 h-4" />
              {timeLeft !== null ? `${timeLeft}s` : '--'}
            </div>
          </div>

          <h2 className="text-xl md:text-2xl font-bold text-slate-900 mb-6 leading-snug">
            {currentQ.text}
          </h2>

          <div className="space-y-3 mb-8">
            {currentQ.type === 'multiple_choice' ? (
              currentQ.options?.map((opt, idx) => (
                <button
                  key={idx}
                  onClick={() => !hasAnswered && (timeLeft || 0) > 0 && setUserAnswer(opt)}
                  disabled={hasAnswered || (timeLeft || 0) === 0}
                  className={clsx(
                    "w-full text-left px-4 py-3 rounded-xl border-2 transition-all font-medium",
                    userAnswer === opt 
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700" 
                      : "border-slate-200 hover:border-slate-300 text-slate-700",
                    (hasAnswered || (timeLeft || 0) === 0) && userAnswer !== opt && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {opt}
                </button>
              ))
            ) : (
              <input
                type="text"
                placeholder="Ketik jawaban Anda..."
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                disabled={hasAnswered || (timeLeft || 0) === 0}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-emerald-500 outline-none disabled:opacity-50 disabled:bg-slate-50"
              />
            )}
          </div>

          {!hasAnswered && (timeLeft || 0) > 0 ? (
            <button
              onClick={handleSubmitAnswer}
              disabled={!userAnswer.trim()}
              className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              Kirim Jawaban
            </button>
          ) : (
            <div className="text-center p-4 bg-slate-50 rounded-xl border border-slate-200">
              <p className="font-bold text-slate-700">
                {hasAnswered ? "Jawaban Anda telah direkam!" : "Waktu Habis!"}
              </p>
              <p className="text-sm text-slate-500 mt-1">Menunggu soal selanjutnya...</p>
            </div>
          )}

          {/* Admin Controls during active quiz */}
          {isAdminOrMod && (
            <div className="mt-8 pt-6 border-t border-slate-100 flex gap-3">
              <button
                onClick={handleStopQuiz}
                className="flex-1 py-2 bg-red-100 text-red-600 rounded-xl font-bold hover:bg-red-200 transition-colors flex items-center justify-center gap-2"
              >
                <Square className="w-4 h-4" /> Hentikan
              </button>
              <button
                onClick={handleNextQuestion}
                className="flex-1 py-2 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
              >
                {quizState.currentQuestionIndex + 1 < quizState.questions.length ? 'Lanjut Soal' : 'Selesai Kuis'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Finished Quiz View (Only Admin/Mod sees results) */}
      {quizState.status === 'finished' && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 text-center">
          <Trophy className="w-16 h-16 mx-auto mb-4 text-yellow-500" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Kuis Selesai!</h2>
          
          {!isAdminOrMod ? (
            <p className="text-slate-600">Terima kasih telah berpartisipasi. Hasil akhir hanya dapat dilihat oleh panitia.</p>
          ) : (
            <div className="mt-8 text-left">
              <h3 className="font-bold text-lg mb-4">Hasil Kuis</h3>
              <div className="space-y-4">
                {/* Simple scoring: count correct answers per user */}
                {(() => {
                  const scores: Record<string, { name: string, score: number }> = {};
                  answers.forEach(a => {
                    if (!scores[a.userId]) scores[a.userId] = { name: a.userName, score: 0 };
                    if (a.isCorrect) scores[a.userId].score += 1;
                  });
                  const sortedScores = Object.values(scores).sort((a, b) => b.score - a.score);
                  
                  if (sortedScores.length === 0) return <p className="text-slate-500 text-center">Belum ada jawaban.</p>;

                  return sortedScores.map((s, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-slate-400 w-6">{idx + 1}.</span>
                        <span className="font-medium text-slate-900">{s.name}</span>
                      </div>
                      <span className="font-bold text-emerald-600">{s.score} Benar</span>
                    </div>
                  ));
                })()}
              </div>
              <button
                onClick={handleStopQuiz}
                className="w-full mt-6 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors"
              >
                Tutup Kuis
              </button>
            </div>
          )}
        </div>
      )}

      {/* Waiting View for Users */}
      {!isAdminOrMod && quizState.status === 'waiting' && (
        <div className="text-center p-12 bg-white rounded-2xl shadow-sm border border-slate-100">
          <HelpCircle className="w-16 h-16 mx-auto mb-4 text-slate-200" />
          <h3 className="text-xl font-bold text-slate-900 mb-2">Belum Ada Kuis</h3>
          <p className="text-slate-500">Tunggu panitia memulai kuis interaktif.</p>
        </div>
      )}
    </div>
  );
}

// --- SPIN WHEEL SECTION ---

interface SpinItem {
  id: string;
  text: string;
  color: string;
}

interface SpinState {
  items: SpinItem[];
  isSpinning: boolean;
  targetIndex: number | null;
  lastSpinTime: number | null;
  lastResult?: SpinItem | null;
  spinDuration?: number; // Duration in seconds
}

function SpinSection({ user, isAdminOrMod }: { user: User, isAdminOrMod: boolean }) {
  const [spinState, setSpinState] = useState<SpinState | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editItems, setEditItems] = useState<SpinItem[]>([]);
  const [newItemText, setNewItemText] = useState('');
  const [editDuration, setEditDuration] = useState(10); // Default 10s
  const wheelRef = useRef<HTMLCanvasElement>(null);
  const [rotation, setRotation] = useState(0);
  
  // Refs for listener to avoid re-subscription
  const rotationRef = useRef(0);
  const lastSpinStateRef = useRef<SpinState | null>(null);
  const isEditingRef = useRef(isEditing);

  useEffect(() => {
    const pendingItems = localStorage.getItem('pendingSpinItems');
    if (pendingItems) {
      try {
        const parsed = JSON.parse(pendingItems);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setEditItems(parsed);
          setIsEditing(true);
          localStorage.removeItem('pendingSpinItems');
        }
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  // Update refs when state changes
  useEffect(() => {
    rotationRef.current = rotation;
  }, [rotation]);

  useEffect(() => {
    isEditingRef.current = isEditing;
  }, [isEditing]);

  // Canvas drawing for the wheel
  useEffect(() => {
    const canvas = wheelRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const items = isEditing ? editItems : (spinState?.items || []);
    const count = items.length;
    if (count === 0) return;

    // Set canvas resolution for high DPI
    const dpr = window.devicePixelRatio || 1;
    // We use a fixed internal size for consistency
    const size = 800; 
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);
    
    const centerX = size / 2;
    const centerY = size / 2;
    const radius = (size / 2) - 20; // padding

    ctx.clearRect(0, 0, size, size);

    const sliceAngle = (2 * Math.PI) / count;

    items.forEach((item, i) => {
      // Start from -90 degrees (top) so index 0 is at the top
      const startAngle = i * sliceAngle - Math.PI / 2;
      const endAngle = startAngle + sliceAngle;

      // Draw Slice
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = item.color;
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      // Draw Text
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(startAngle + sliceAngle / 2);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'white';
      ctx.font = 'bold 32px "Inter", sans-serif';
      
      // Text Shadow
      ctx.shadowColor = 'rgba(0,0,0,0.3)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;

      // Truncate text if too long
      const maxTextWidth = radius - 80;
      let text = item.text;
      if (ctx.measureText(text).width > maxTextWidth) {
        while (ctx.measureText(text + '...').width > maxTextWidth && text.length > 0) {
          text = text.slice(0, -1);
        }
        text += '...';
      }
      
      ctx.fillText(text, radius - 40, 0);
      ctx.restore();
    });

    // Draw Center Dot
    ctx.beginPath();
    ctx.arc(centerX, centerY, 30, 0, 2 * Math.PI);
    ctx.fillStyle = 'white';
    ctx.fill();
    ctx.shadowColor = 'rgba(0,0,0,0.2)';
    ctx.shadowBlur = 5;
    ctx.stroke();

  }, [isEditing ? editItems : spinState?.items]);

  useEffect(() => {
    const unsubSpin = onSnapshot(doc(db, 'entertainment', 'spin'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as SpinState;
        setSpinState(data);
        
        if (!isEditingRef.current) {
          setEditItems(data.items || []);
          setEditDuration(data.spinDuration || 10);
        }
        
        // Handle animation only when spinning starts
        const lastState = lastSpinStateRef.current;
        
        // Check if a new spin has started
        // Condition: Currently spinning, target is set, and (previously not spinning OR it's a new spin time)
        const isNewSpin = data.isSpinning && data.targetIndex !== null && 
          (!lastState || !lastState.isSpinning || lastState.lastSpinTime !== data.lastSpinTime);

        if (isNewSpin) {
          const itemsCount = data.items.length;
          const sliceAngle = 360 / itemsCount;
          
          // Calculate random offset within the slice (avoiding the exact edges)
          // The slice goes from (index * sliceAngle) to ((index + 1) * sliceAngle)
          // We want the pointer (top, which is -90deg or 270deg) to land somewhere inside this slice.
          // To make it land randomly within the slice, we add a random offset between 5% and 95% of the slice width.
          const randomOffset = sliceAngle * (0.05 + Math.random() * 0.9);
          const targetAngleFromStart = (data.targetIndex! * sliceAngle) + randomOffset;
          const targetRotation = -targetAngleFromStart;
          
          // Use ref for current rotation to calculate next step
          const currentRotation = rotationRef.current;
          
          // Add 5 full spins (1800 deg)
          let newRotation = currentRotation - 1800;
          const currentMod = newRotation % 360;
          const targetMod = targetRotation % 360;
          
          let diff = targetMod - currentMod;
          if (diff > 0) diff -= 360;
          
          newRotation += diff;
          
          setRotation(newRotation);
        }
        
        lastSpinStateRef.current = data;
      } else {
        if (isAdminOrMod) {
          setDoc(doc(db, 'entertainment', 'spin'), {
            items: [
              { id: '1', text: 'Zonk', color: '#ef4444' },
              { id: '2', text: 'Hadiah 1', color: '#10b981' },
              { id: '3', text: 'Zonk', color: '#ef4444' },
              { id: '4', text: 'Hadiah 2', color: '#3b82f6' },
            ],
            isSpinning: false,
            targetIndex: null,
            lastSpinTime: null,
            spinDuration: 10
          });
        }
      }
    });

    return () => unsubSpin();
  }, [isAdminOrMod]); // Removed unstable dependencies

  const handleSaveItems = async () => {
    if (editItems.length < 2) {
      toast.error('Minimal 2 item untuk putaran');
      return;
    }
    try {
      await updateDoc(doc(db, 'entertainment', 'spin'), {
        items: editItems,
        spinDuration: editDuration,
        isSpinning: false,
        targetIndex: null,
        lastResult: null
      });
      setIsEditing(false);
      toast.success('Pengaturan putaran berhasil disimpan');
    } catch (err) {
      console.error(err);
      toast.error('Gagal menyimpan pengaturan');
    }
  };

  const [isResetting, setIsResetting] = useState(false);

  const handleResetSpin = async () => {
    if (window.confirm('Apakah Anda yakin ingin mereset putaran? Semua item akan dihapus.')) {
      setIsResetting(true);
      try {
        // Use setDoc to overwrite everything cleanly with empty items
        await setDoc(doc(db, 'entertainment', 'spin'), {
          items: [],
          isSpinning: false,
          targetIndex: null,
          lastSpinTime: null,
          lastResult: null,
          spinDuration: 10
        });
        
        // Force update local state immediately
        setEditItems([]);
        setEditDuration(10);
        setRotation(0);
        setSpinState(prev => prev ? ({ ...prev, items: [], isSpinning: false, targetIndex: null, lastResult: null }) : null);
        
        toast.success('Putaran berhasil direset (semua item dihapus)');
      } catch (err) {
        console.error(err);
        toast.error('Gagal mereset putaran');
      } finally {
        setIsResetting(false);
      }
    }
  };

  const handleSpin = async () => {
    if (!spinState || spinState.items.length < 2 || spinState.isSpinning) return;
    
    // Pick a random winner
    const targetIndex = Math.floor(Math.random() * spinState.items.length);
    const selectedItem = spinState.items[targetIndex];
    const duration = spinState.spinDuration || 10;
    const spinTime = Date.now();
    
    await updateDoc(doc(db, 'entertainment', 'spin'), {
      isSpinning: true,
      targetIndex,
      lastSpinTime: spinTime,
      lastResult: null
    });

      // Reset spinning state after animation
      setTimeout(async () => {
        // Check if the spin was reset or changed during animation
        let currentItems = spinState.items;
        try {
          const currentDoc = await getDocs(query(collection(db, 'entertainment'), where('__name__', '==', 'spin')));
          if (!currentDoc.empty) {
              const data = currentDoc.docs[0].data() as SpinState;
              // If lastSpinTime has changed (e.g. by a reset), abort
              if (data.lastSpinTime !== spinTime) {
                  console.log('Spin aborted due to reset');
                  return;
              }
              currentItems = data.items || [];
          }
        } catch (e) {
          console.error("Error checking spin state", e);
        }

        // Just update the result, do not auto-delete or auto-confirm
        await updateDoc(doc(db, 'entertainment', 'spin'), {
          isSpinning: false,
          items: currentItems, 
          targetIndex: null,
          lastResult: selectedItem
        });
        toast.success(`Hasil putaran: ${selectedItem.text}`);
      }, (duration * 1000) + 500); // Duration + buffer
    };

    const handleCloseResult = async () => {
      try {
        await updateDoc(doc(db, 'entertainment', 'spin'), {
          lastResult: null
        });
      } catch (err) {
        console.error(err);
      }
    };

    const handleDeleteLastResult = async () => {
      if (!spinState?.lastResult) return;
      
      if (window.confirm(`Apakah Anda yakin ingin menghapus "${spinState.lastResult.text}" secara permanen dari daftar putaran?`)) {
        try {
          // Fetch latest data to ensure we don't overwrite other changes
          const currentDoc = await getDocs(query(collection(db, 'entertainment'), where('__name__', '==', 'spin')));
          if (currentDoc.empty) return;
          
          const data = currentDoc.docs[0].data() as SpinState;
          const currentItems = data.items || [];
          
          // Try to find item by ID first
          let newItems = currentItems.filter(item => item.id !== spinState.lastResult!.id);
          
          // If length is same, try by text (fallback in case ID changed or mismatch)
          if (newItems.length === currentItems.length) {
             newItems = currentItems.filter(item => item.text !== spinState.lastResult!.text);
          }
          
          await updateDoc(doc(db, 'entertainment', 'spin'), {
            items: newItems,
            lastResult: null // Clear result after deleting
          });
          
          // Update local state immediately for responsiveness
          setSpinState(prev => prev ? ({ ...prev, items: newItems, lastResult: null }) : null);
          
          toast.success('Item berhasil dihapus dari putaran');
        } catch (err) {
          console.error(err);
          toast.error('Gagal menghapus item');
        }
      }
    };

  if (!spinState) return <div className="p-8 text-center text-slate-500">Memuat putaran...</div>;

  const displayItems = isEditing ? editItems : spinState.items;
  const itemsCount = displayItems.length;
  const sliceAngle = 360 / itemsCount;
  const currentDuration = spinState.spinDuration || 10;

  return (
    <div className="space-y-6">
      {/* ... (Admin Controls omitted for brevity, keeping existing) ... */}
      {isAdminOrMod && (
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-900">Pengaturan Putaran (Admin)</h3>
            <div className="flex gap-3">
              <button
                onClick={handleResetSpin}
                disabled={isResetting}
                className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
              >
                {isResetting ? 'Mereset...' : 'Reset Putaran'}
              </button>
              <button
                onClick={() => setIsEditing(!isEditing)}
                disabled={spinState.isSpinning}
                className="text-sm font-medium text-emerald-600 hover:text-emerald-700 disabled:opacity-50"
              >
                {isEditing ? 'Batal Edit' : 'Edit Item'}
              </button>
            </div>
          </div>

          {isEditing ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-4 p-3 bg-white rounded-lg border border-slate-200">
                  <Clock className="w-4 h-4 text-slate-500" />
                  <span className="text-sm font-medium text-slate-700">Durasi Putaran (detik):</span>
                  <input 
                    type="number" 
                    min="1" 
                    max="60" 
                    value={editDuration}
                    onChange={(e) => setEditDuration(Math.max(1, parseInt(e.target.value) || 10))}
                    className="w-20 px-2 py-1 border border-slate-300 rounded text-sm"
                  />
                </div>
                {editItems.map((item, idx) => (
                  <div key={item.id} className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={item.color}
                      onChange={(e) => {
                        const newItems = [...editItems];
                        newItems[idx].color = e.target.value;
                        setEditItems(newItems);
                      }}
                      className="w-10 h-10 rounded cursor-pointer border-0 p-0"
                    />
                    <input
                      type="text"
                      value={item.text}
                      onChange={(e) => {
                        const newItems = [...editItems];
                        newItems[idx].text = e.target.value;
                        setEditItems(newItems);
                      }}
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                    <button onClick={async () => {
                      const newItems = editItems.filter((_, i) => i !== idx);
                      setEditItems(newItems);
                      await updateDoc(doc(db, 'entertainment', 'spin'), { items: newItems });
                    }} className="text-red-500 p-2 hover:bg-red-50 rounded-lg">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Item baru..."
                  value={newItemText}
                  onChange={(e) => setNewItemText(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter' && newItemText.trim()) {
                      const newItems = [...editItems, { id: Date.now().toString(), text: newItemText.trim(), color: DEFAULT_COLORS[editItems.length % DEFAULT_COLORS.length] }];
                      setEditItems(newItems);
                      setNewItemText('');
                      await updateDoc(doc(db, 'entertainment', 'spin'), { items: newItems });
                    }
                  }}
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
                <button
                  onClick={async () => {
                    if (newItemText.trim()) {
                      const newItems = [...editItems, { id: Date.now().toString(), text: newItemText.trim(), color: DEFAULT_COLORS[editItems.length % DEFAULT_COLORS.length] }];
                      setEditItems(newItems);
                      setNewItemText('');
                      await updateDoc(doc(db, 'entertainment', 'spin'), { items: newItems });
                    }
                  }}
                  className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg font-bold hover:bg-slate-300"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <button
                onClick={handleSaveItems}
                className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors"
              >
                Simpan Pengaturan
              </button>
            </div>
          ) : (
            <button
              onClick={handleSpin}
              disabled={spinState.isSpinning || spinState.items.length < 2}
              className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={clsx("w-5 h-5", spinState.isSpinning && "animate-spin")} /> 
              {spinState.isSpinning ? 'Sedang Memutar...' : 'Putar Sekarang'}
            </button>
          )}
        </div>
      )}

      {/* Wheel Display */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center overflow-hidden">
        <div className="relative w-64 h-64 md:w-80 md:h-80 my-8">
          {/* Pointer */}
          <div className="absolute -top-6 left-1/2 -translate-x-1/2 z-10 filter drop-shadow-lg">
             <div className="w-0 h-0 border-l-[20px] border-r-[20px] border-t-[40px] border-l-transparent border-r-transparent border-t-slate-900"></div>
          </div>
          
          {/* Wheel Canvas Container */}
          <div 
            className="w-full h-full rounded-full overflow-hidden relative shadow-2xl border-4 border-slate-900 bg-white"
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: spinState.isSpinning ? `transform ${currentDuration}s cubic-bezier(0.1, 0.7, 0.1, 1)` : 'none'
            }}
          >
            <canvas 
              ref={wheelRef}
              className="w-full h-full object-cover"
              style={{ width: '100%', height: '100%' }}
            />
          </div>
        </div>

        {/* Result Display */}
        {!spinState.isSpinning && spinState.lastResult && (
          <div className="mt-4 text-center animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col items-center gap-3">
            <div>
              <p className="text-sm text-slate-500 font-medium mb-1">Hasil Putaran:</p>
              <h3 className="text-2xl md:text-3xl font-black text-emerald-600 uppercase tracking-wide">
                {spinState.lastResult.text}
              </h3>
            </div>
            
            {isAdminOrMod && (
              <div className="flex gap-2">
                <button
                  onClick={handleCloseResult}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-bold hover:bg-slate-200 transition-colors"
                >
                  Tutup
                </button>
                <button
                  onClick={handleDeleteLastResult}
                  className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-bold hover:bg-red-100 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Hapus Item
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
