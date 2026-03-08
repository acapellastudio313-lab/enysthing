import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { User } from '../types';
import { Gamepad2, HelpCircle, RefreshCw, Plus, Trash2, Play, Square, Trophy, CheckCircle, XCircle, Clock, Hash, Dices, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import { collection, doc, onSnapshot, setDoc, updateDoc, addDoc, getDocs, deleteDoc, serverTimestamp, query, where, orderBy, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { toast } from 'sonner';
import { triggerLuckyNumberEvent, assignLuckyNumbers, listenToLuckyNumberEvent, getAllUsers, updateUserLuckyNumber, updateLuckyNumberPool, listenToLuckyNumberPool } from '../lib/db';
import { motion, AnimatePresence } from 'motion/react';

export default function Entertainment({ user }: { user: User }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get('tab') as 'kuis' | 'spin' | 'lucky') || 'kuis';

  const setActiveTab = (tab: 'kuis' | 'spin' | 'lucky') => {
    setSearchParams({ tab });
  };

  const isAdminOrMod = user.role === 'admin' || user.role === 'moderator';

  return (
    <div className="w-full max-w-2xl mx-auto pb-20 md:pb-0">
      <div className="bg-white sticky top-[60px] z-20 border-b border-slate-100 px-4 pt-2">
        <div className="flex gap-4 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('kuis')}
            className={clsx(
              "pb-3 font-bold text-sm transition-colors relative shrink-0",
              activeTab === 'kuis' ? "text-emerald-600" : "text-slate-500 hover:text-slate-900"
            )}
          >
            <div className="flex items-center gap-2">
              <HelpCircle className="w-4 h-4" />
              Kuis Interaktif
            </div>
            {activeTab === 'kuis' && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-600 rounded-t-full" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('spin')}
            className={clsx(
              "pb-3 font-bold text-sm transition-colors relative shrink-0",
              activeTab === 'spin' ? "text-emerald-600" : "text-slate-500 hover:text-slate-900"
            )}
          >
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              Putaran Bebas
            </div>
            {activeTab === 'spin' && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-600 rounded-t-full" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('lucky')}
            className={clsx(
              "pb-3 font-bold text-sm transition-colors relative shrink-0",
              activeTab === 'lucky' ? "text-emerald-600" : "text-slate-500 hover:text-slate-900"
            )}
          >
            <div className="flex items-center gap-2">
              <Hash className="w-4 h-4" />
              Dapatkan Nomor
            </div>
            {activeTab === 'lucky' && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-600 rounded-t-full" />
            )}
          </button>
        </div>
      </div>

      <div className="p-4">
        {activeTab === 'kuis' ? (
          <QuizSection user={user} isAdminOrMod={isAdminOrMod} />
        ) : activeTab === 'spin' ? (
          <SpinSection user={user} isAdminOrMod={isAdminOrMod} />
        ) : (
          <LuckyNumberSection user={user} isAdminOrMod={isAdminOrMod} />
        )}
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
                onClick={() => {
                  const newId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                  setEditQuestions([...editQuestions, { id: newId, type: 'multiple_choice', text: '', options: ['A', 'B'], timeLimit: 30 }]);
                }}
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

const DEFAULT_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

// --- LUCKY NUMBER SECTION ---

function LuckyNumberSection({ user, isAdminOrMod }: { user: User, isAdminOrMod: boolean }) {
  const [event, setEvent] = useState<any>(null);
  const [rollingNumber, setRollingNumber] = useState(0);
  const [isRolling, setIsRolling] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentUserLuckyNumber, setCurrentUserLuckyNumber] = useState<number | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [pool, setPool] = useState({ min: 1, max: 100 });
  const [customInputs, setCustomInputs] = useState<Record<string, string>>({});
  const [showUserList, setShowUserList] = useState(false);
  const [showPoolSettings, setShowPoolSettings] = useState(false);

  useEffect(() => {
    const unsubscribeEvent = listenToLuckyNumberEvent((data) => {
      setEvent(data);
      if (data.status === 'rolling') {
        startRollingAnimation();
      }
    });

    const unsubscribeUser = onSnapshot(doc(db, 'users', user.id), (docSnap) => {
      if (docSnap.exists()) {
        setCurrentUserLuckyNumber(docSnap.data().lucky_number || null);
      }
    });

    const unsubscribePool = listenToLuckyNumberPool((data) => {
      setPool(data);
    });

    if (isAdminOrMod) {
      getAllUsers().then(allUsers => {
        // Ensure uniqueness by ID
        const uniqueUsers = allUsers.filter((u, index, self) => 
          index === self.findIndex((t) => t.id === u.id)
        );
        setUsers(uniqueUsers);
      }).catch(console.error);
    }

    return () => {
      unsubscribeEvent();
      unsubscribeUser();
      unsubscribePool();
    };
  }, [user.id, isAdminOrMod]);

  const startRollingAnimation = () => {
    setIsRolling(true);
    const duration = 3000; // 3 seconds
    const interval = 50; // 50ms
    const steps = duration / interval;
    let currentStep = 0;

    const timer = setInterval(() => {
      setRollingNumber(Math.floor(Math.random() * (pool.max - pool.min + 1)) + pool.min);
      currentStep++;
      if (currentStep >= steps) {
        clearInterval(timer);
        setIsRolling(false);
      }
    }, interval);
  };

  const handleTriggerRandom = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      await triggerLuckyNumberEvent('random');
      // Wait for animation to finish before assigning numbers in DB
      setTimeout(async () => {
        await assignLuckyNumbers('random', undefined, pool);
        setIsProcessing(false);
        toast.success('Nomor acak berhasil diberikan ke semua akun!');
      }, 3000);
    } catch (err) {
      console.error(err);
      toast.error('Gagal memberikan nomor acak');
      setIsProcessing(false);
    }
  };

  const handleUpdateUserNumber = async (targetUserId: string) => {
    const val = parseInt(customInputs[targetUserId]);
    if (isNaN(val)) {
      toast.error('Masukkan nomor yang valid');
      return;
    }
    try {
      await updateUserLuckyNumber(targetUserId, val);
      toast.success('Nomor berhasil diperbarui');
    } catch (err) {
      console.error(err);
      toast.error('Gagal memperbarui nomor');
    }
  };

  const handleSavePool = async () => {
    try {
      await updateLuckyNumberPool(pool.min, pool.max);
      setShowPoolSettings(false);
      toast.success('Rentang nomor berhasil disimpan');
    } catch (err) {
      console.error(err);
      toast.error('Gagal menyimpan rentang nomor');
    }
  };

  return (
    <div className="space-y-6">
      {/* Admin Controls */}
      {isAdminOrMod && (
        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <Hash className="w-5 h-5 text-emerald-600" />
              Kontrol Nomor Beruntung (Admin)
            </h3>
            <div className="flex gap-2">
              <button
                onClick={() => setShowPoolSettings(!showPoolSettings)}
                className={clsx(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-colors",
                  showPoolSettings ? "bg-emerald-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                )}
              >
                Kustom Nomor ({pool.min}-{pool.max})
              </button>
              <button
                onClick={() => setShowUserList(!showUserList)}
                className={clsx(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-colors",
                  showUserList ? "bg-emerald-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                )}
              >
                Atur Per Akun
              </button>
            </div>
          </div>
          
          <AnimatePresence>
            {showPoolSettings && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden mb-6"
              >
                <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-4">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pengaturan Rentang Nomor Acak</p>
                  <div className="flex items-center gap-4">
                    <div className="flex-1 space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Min</label>
                      <input
                        type="number"
                        value={pool.min}
                        onChange={(e) => setPool({ ...pool, min: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                      />
                    </div>
                    <div className="flex-1 space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Max</label>
                      <input
                        type="number"
                        value={pool.max}
                        onChange={(e) => setPool({ ...pool, max: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                      />
                    </div>
                    <button
                      onClick={handleSavePool}
                      className="mt-5 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold hover:bg-slate-800"
                    >
                      Simpan
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {showUserList && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden mb-6"
              >
                <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-4 max-h-[400px] overflow-y-auto no-scrollbar">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Daftar Akun & Nomor Kustom</p>
                  <div className="space-y-2">
                    {users.map((u, idx) => (
                      <div key={`${u.id}-${idx}`} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg border border-transparent hover:border-slate-100 transition-all">
                        <div className="flex items-center gap-3">
                          <img src={u.avatar} alt={u.name} className="w-8 h-8 rounded-full border border-slate-200" />
                          <div>
                            <p className="text-sm font-bold text-slate-900 leading-none">{u.name}</p>
                            <p className="text-[10px] text-slate-500 font-medium">@{u.username}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            placeholder={u.lucky_number?.toString() || "000"}
                            value={customInputs[u.id] || ''}
                            onChange={(e) => setCustomInputs({ ...customInputs, [u.id]: e.target.value })}
                            className="w-20 px-2 py-1 border border-slate-200 rounded-lg text-xs font-mono text-center"
                          />
                          <button
                            onClick={() => handleUpdateUserNumber(u.id)}
                            className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg hover:bg-emerald-200 transition-colors"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex flex-col items-center justify-center p-8 bg-white border-2 border-dashed border-slate-300 rounded-3xl hover:border-emerald-500 hover:bg-emerald-50 transition-all group cursor-pointer"
            onClick={handleTriggerRandom}
          >
            <div className={clsx(
              "w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-all",
              isProcessing ? "bg-emerald-100 text-emerald-600 animate-pulse" : "bg-slate-100 text-slate-400 group-hover:bg-emerald-100 group-hover:text-emerald-600"
            )}>
              <Dices className="w-8 h-8" />
            </div>
            <span className="font-black text-xl text-slate-900">Berikan Nomor Acak</span>
            <p className="text-sm text-slate-500 mt-1 text-center max-w-[240px]">
              Klik untuk mengacak nomor untuk semua akun berdasarkan rentang <span className="font-bold text-emerald-600">{pool.min}-{pool.max}</span>
            </p>
          </div>
        </div>
      )}

      {/* Display Section */}
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center relative overflow-hidden min-h-[400px]">
        {/* Background Decoration */}
        <div className="absolute top-0 left-0 w-full h-full opacity-[0.03] pointer-events-none">
          <div className="absolute top-10 left-10 rotate-12"><Hash className="w-20 h-20" /></div>
          <div className="absolute bottom-10 right-10 -rotate-12"><Dices className="w-24 h-24" /></div>
        </div>

        <AnimatePresence mode="wait">
          {isRolling ? (
            <motion.div
              key="rolling"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.2 }}
              className="space-y-4"
            >
              <div className="text-6xl md:text-8xl font-black text-emerald-600 font-mono tracking-tighter">
                {rollingNumber.toString().padStart(3, '0')}
              </div>
              <p className="text-slate-500 font-bold animate-pulse uppercase tracking-widest text-sm">
                Mengacak Nomor...
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {currentUserLuckyNumber ? (
                <>
                  <div className="inline-block px-4 py-1.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold uppercase tracking-wider mb-2">
                    Nomor Anda
                  </div>
                  <div className="text-7xl md:text-9xl font-black text-slate-900 font-mono tracking-tighter drop-shadow-sm">
                    {currentUserLuckyNumber.toString().padStart(3, '0')}
                  </div>
                  <p className="text-slate-500 max-w-xs mx-auto text-sm leading-relaxed">
                    Ini adalah nomor beruntung Anda. Simpan nomor ini untuk kejutan menarik selanjutnya!
                  </p>
                </>
              ) : (
                <>
                  <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Hash className="w-12 h-12 text-slate-300" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">Belum Ada Nomor</h3>
                  <p className="text-slate-500 max-w-xs mx-auto text-sm">
                    Tunggu Admin atau Moderator memberikan nomor beruntung untuk Anda.
                  </p>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {isProcessing && !isRolling && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] flex items-center justify-center z-10">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
              <p className="text-sm font-bold text-slate-700">Memproses Data...</p>
            </div>
          </div>
        )}
      </div>

      {/* Info Card */}
      <div className="bg-emerald-600 p-6 rounded-2xl text-white">
        <h4 className="font-bold mb-2 flex items-center gap-2">
          <Trophy className="w-5 h-5" />
          Tentang Dapatkan Nomor
        </h4>
        <p className="text-sm text-emerald-50 opacity-90 leading-relaxed">
          Fitur ini digunakan untuk pembagian nomor undian, nomor antrian, atau identitas unik lainnya secara instan dan transparan. Semua proses dilakukan secara real-time.
        </p>
      </div>
    </div>
  );
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
          
          const targetAngleFromStart = (data.targetIndex! * sliceAngle) + (sliceAngle / 2);
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
                      const newId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                      const newItems = [...editItems, { id: newId, text: newItemText.trim(), color: DEFAULT_COLORS[editItems.length % DEFAULT_COLORS.length] }];
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
                      const newId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                      const newItems = [...editItems, { id: newId, text: newItemText.trim(), color: DEFAULT_COLORS[editItems.length % DEFAULT_COLORS.length] }];
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
