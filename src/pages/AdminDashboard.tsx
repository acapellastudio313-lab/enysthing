import { useState, useEffect, FormEvent, MouseEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { User, Post, Candidate, ElectionStatus } from '../types';
import { Trash2, Shield, UserCheck, Users, FileText, BarChart2, AlertTriangle, Edit3, CheckCircle, X, Trophy, Clock, RefreshCw, RotateCcw, Loader2, UserPlus } from 'lucide-react';
import { formatDateWIB } from '../utils';
import { toast } from 'sonner';
import { 
  getStats, 
  getAllUsers, 
  listenToPosts, 
  getCandidates, 
  getLeaderboard, 
  listenToSettings, 
  updateSetting, 
  deleteUser, 
  deletePost, 
  addCandidate, 
  removeCandidate, 
  resetVotes as resetVotesDb, 
  resetAllData,
  updateUser,
  updateCandidate,
  createUser,
  getCandidateVoters
} from '../lib/db';

export default function AdminDashboard({ user }: { user: User }) {
  const [stats, setStats] = useState({ users: 0, posts: 0, votes: 0, candidates: 0 });
  const [users, setUsers] = useState<User[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get('tab') as 'users' | 'posts' | 'candidates' | 'leaderboard') || 'users';

  const setActiveTab = (tab: 'users' | 'posts' | 'candidates' | 'leaderboard') => {
    setSearchParams({ tab });
  };

  const [loading, setLoading] = useState(true);
  const [electionStatus, setElectionStatus] = useState<ElectionStatus>('not_started');
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [electionEndDate, setElectionEndDate] = useState<string>('');
  const [leaderboardTitle, setLeaderboardTitle] = useState('');
  const [leaderboardDescription, setLeaderboardDescription] = useState('');
  const [updatingLeaderboard, setUpdatingLeaderboard] = useState(false);

  const [exploreTitle, setExploreTitle] = useState('');
  const [exploreSchedule, setExploreSchedule] = useState('');
  const [exploreRequirement, setExploreRequirement] = useState('');
  const [exploreHelp, setExploreHelp] = useState('');
  const [updatingExplore, setUpdatingExplore] = useState(false);

  const [candidatePageTitle, setCandidatePageTitle] = useState('');
  const [candidatePageDescription, setCandidatePageDescription] = useState('');
  const [updatingCandidatePage, setUpdatingCandidatePage] = useState(false);

  const [appName, setAppName] = useState('');
  const [appSubtitle, setAppSubtitle] = useState('');
  const [appLogo, setAppLogo] = useState('');
  const [appIcon, setAppIcon] = useState('');
  const [candidateLabel, setCandidateLabel] = useState('');
  const [candidateDescLabel, setCandidateDescLabel] = useState('');
  const [updatingGeneral, setUpdatingGeneral] = useState(false);

  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ name: '', username: '', bio: '', role: 'voter', is_verified: 0, is_approved: 1, password: '' });
  
  const [votersModal, setVotersModal] = useState<{ isOpen: boolean, candidateName: string, voters: User[] }>({
    isOpen: false,
    candidateName: '',
    voters: []
  });
  const [loadingVoters, setLoadingVoters] = useState(false);

  const handleViewVoters = async (candidateId: string, candidateName: string) => {
    setLoadingVoters(true);
    setVotersModal({ isOpen: true, candidateName, voters: [] });
    try {
      const voters = await getCandidateVoters(candidateId);
      setVotersModal({ isOpen: true, candidateName, voters });
    } catch (err) {
      console.error('Failed to fetch voters', err);
      toast.error('Gagal memuat data pemilih');
    } finally {
      setLoadingVoters(false);
    }
  };

  const [isAddingUser, setIsAddingUser] = useState(false);
  const [addUserForm, setAddUserForm] = useState({ name: '', username: '', password: '', bio: '', role: 'voter', is_verified: 0, is_approved: 1 });

  const [editingCandidate, setEditingCandidate] = useState<Candidate | null | 'new'>(null);
  const [candidateForm, setCandidateForm] = useState({ name: '', username: '', avatar: '', vision: '', mission: '', innovation_program: '', image_url: '' });
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  const [deleteCandidateId, setDeleteCandidateId] = useState<string | null>(null);
  const [showResetConfirmation, setShowResetConfirmation] = useState(false);
  const [resetConfirmationText, setResetConfirmationText] = useState('');
  
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ isOpen: boolean, userId: string | null, userName: string }>({
    isOpen: false,
    userId: null,
    userName: ''
  });

  useEffect(() => {
    const fetchData = async () => {
      const s = await getStats();
      setStats(s);
      
      const u = await getAllUsers();
      setUsers(u);
      
      const c = await getCandidates();
      setCandidates(c);
      
      const l = await getLeaderboard();
      setLeaderboard(l);
    };

    fetchData();

    const unsubscribePosts = listenToPosts((p) => setPosts(p));
    const unsubscribeSettings = listenToSettings((settings) => {
      const status = settings.election_status as ElectionStatus;
      if (status) setElectionStatus(status);

      const endDate = settings.election_end_date;
      if (endDate) {
        const date = new Date(endDate);
        date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
        setElectionEndDate(date.toISOString().slice(0, 16));
      }

      setLeaderboardTitle(settings.leaderboard_title || '');
      setLeaderboardDescription(settings.leaderboard_description || '');
      setExploreTitle(settings.explore_title || '');
      setExploreSchedule(settings.explore_schedule || '');
      setExploreRequirement(settings.explore_requirement || '');
      setExploreHelp(settings.explore_help || '');
      setCandidatePageTitle(settings.candidate_page_title || '');
      setCandidatePageDescription(settings.candidate_page_description || '');
      setAppName(settings.app_name || '');
      setAppSubtitle(settings.app_subtitle || '');
      setAppLogo(settings.app_logo || '');
      setAppIcon(settings.app_icon || '');
      setCandidateLabel(settings.candidate_label || '');
      setCandidateDescLabel(settings.candidate_desc_label || '');
      
      setLoading(false);
    });

    return () => {
      unsubscribePosts();
      unsubscribeSettings();
    };
  }, []);

  useEffect(() => {
    if (electionStatus !== 'in_progress' || !electionEndDate) {
      return;
    }

    const timer = setInterval(() => {
      const now = new Date().getTime();
      const end = new Date(electionEndDate).getTime();
      
      if (end - now <= 0) {
        clearInterval(timer);
        setElectionStatus('closed');
        // Optionally, we could call an API to ensure the server knows, 
        // but the server will check it on the next request anyway.
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [electionStatus, electionEndDate]);

  const [refreshingStatus, setRefreshingStatus] = useState(false);
  const [resettingVotes, setResettingVotes] = useState(false);

  const updateLeaderboardSettings = async () => {
    setUpdatingLeaderboard(true);
    try {
      await updateSetting('leaderboard_title', leaderboardTitle);
      await updateSetting('leaderboard_description', leaderboardDescription);
      setStatusMessage({ type: 'success', text: 'Pengaturan klasemen berhasil diperbarui' });
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err: any) {
      console.error(err);
      setStatusMessage({ type: 'error', text: err.message });
    } finally {
      setUpdatingLeaderboard(false);
    }
  };

  const updateExploreSettings = async () => {
    setUpdatingExplore(true);
    try {
      await updateSetting('explore_title', exploreTitle);
      await updateSetting('explore_schedule', exploreSchedule);
      await updateSetting('explore_requirement', exploreRequirement);
      await updateSetting('explore_help', exploreHelp);
      setStatusMessage({ type: 'success', text: 'Pengaturan informasi pemilihan berhasil diperbarui' });
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err: any) {
      console.error(err);
      setStatusMessage({ type: 'error', text: err.message });
    } finally {
      setUpdatingExplore(false);
    }
  };

  const updateCandidatePageSettings = async () => {
    setUpdatingCandidatePage(true);
    try {
      await updateSetting('candidate_page_title', candidatePageTitle);
      await updateSetting('candidate_page_description', candidatePageDescription);
      setStatusMessage({ type: 'success', text: 'Pengaturan halaman kandidat berhasil diperbarui' });
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err: any) {
      console.error(err);
      setStatusMessage({ type: 'error', text: err.message });
    } finally {
      setUpdatingCandidatePage(false);
    }
  };

  const updateGeneralSettings = async () => {
    setUpdatingGeneral(true);
    try {
      await updateSetting('app_name', appName);
      await updateSetting('app_subtitle', appSubtitle);
      await updateSetting('app_logo', appLogo);
      await updateSetting('app_icon', appIcon);
      await updateSetting('candidate_label', candidateLabel);
      await updateSetting('candidate_desc_label', candidateDescLabel);
      setStatusMessage({ type: 'success', text: 'Pengaturan umum berhasil diperbarui' });
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err: any) {
      console.error(err);
      setStatusMessage({ type: 'error', text: err.message });
    } finally {
      setUpdatingGeneral(false);
    }
  };

  const [updatingEndDate, setUpdatingEndDate] = useState(false);

  const updateElectionEndDate = async () => {
    if (!electionEndDate) {
      alert('Silakan pilih tanggal dan waktu');
      return;
    }

    setUpdatingEndDate(true);
    try {
      await updateSetting('election_end_date', new Date(electionEndDate).toISOString());
      setStatusMessage({ type: 'success', text: 'Tanggal berakhir pemilihan berhasil diperbarui' });
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err: any) {
      console.error(err);
      setStatusMessage({ type: 'error', text: err.message || 'Gagal memperbarui tanggal' });
    } finally {
      setUpdatingEndDate(false);
    }
  };

  const resetVotes = async () => {
    if (!confirm('PERINGATAN: Apakah Anda yakin ingin menghapus SEMUA suara? Tindakan ini tidak dapat dibatalkan.')) return;
    
    setResettingVotes(true);
    setStatusMessage(null);
    try {
      await resetVotesDb();
      setStatusMessage({ type: 'success', text: 'Semua suara berhasil dihapus' });
      const s = await getStats();
      setStats(s);
      const l = await getLeaderboard();
      setLeaderboard(l);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Gagal menghapus suara' });
    } finally {
      setResettingVotes(false);
    }
  };

  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const updateElectionStatus = async (status: ElectionStatus) => {
    // Clear previous messages
    setStatusMessage(null);
    
    // Optimistic update
    const previousStatus = electionStatus;
    setElectionStatus(status);
    setUpdatingStatus(true);
    
    try {
      // If switching to in_progress, ensure we have a valid future date
      if (status === 'in_progress') {
        const now = new Date().getTime();
        const currentEnd = electionEndDate ? new Date(electionEndDate).getTime() : 0;
        
        if (!electionEndDate || currentEnd <= now) {
          // Set default to 24 hours from now
          const tomorrow = new Date();
          tomorrow.setHours(tomorrow.getHours() + 24);
          const tomorrowStr = tomorrow.toISOString().slice(0, 16); // Format for datetime-local
          setElectionEndDate(tomorrowStr);
          await updateSetting('election_end_date', tomorrowStr);
        }
      }

      await updateSetting('election_status', status);
      // Do NOT setElectionStatus(status) here again, let the listener handle it
      setStatusMessage({ type: 'success', text: 'Status pemilihan berhasil diperbarui' });
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err: any) {
      console.error('Failed to update election status', err);
      setElectionStatus(previousStatus); // Revert on error
      setStatusMessage({ type: 'error', text: err.message || 'Gagal memperbarui status' });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const fetchCandidates = async () => {
    try {
      const data = await getCandidates();
      setCandidates(data);
    } catch (err: any) {
      console.error('Failed to fetch candidates', err);
    }
  };

  const fetchStats = async () => {
    try {
      const data = await getStats();
      setStats(data);
    } catch (err: any) {
      console.error('Failed to fetch stats', err);
    }
  };

  const fetchUsers = async () => {
    try {
      const data = await getAllUsers();
      setUsers(data);
    } catch (err: any) {
      console.error('Error fetching users:', err);
    }
  };

  const handleDeleteUser = (userId: string) => {
    const userToDelete = users.find(u => u.id === userId);
    if (!userToDelete) return;
    
    setDeleteConfirmation({
      isOpen: true,
      userId: userId,
      userName: userToDelete.name
    });
  };

  const processDeleteUser = async () => {
    const userId = deleteConfirmation.userId;
    if (!userId) return;

    try {
      await deleteUser(userId);
      setUsers(users.filter(u => u.id !== userId));
      const s = await getStats();
      setStats(s);
      const c = await getCandidates();
      setCandidates(c);
      const l = await getLeaderboard();
      setLeaderboard(l);
      toast.success('Pengguna berhasil dihapus');
      
      // Close modals
      setDeleteConfirmation({ isOpen: false, userId: null, userName: '' });
      if (editingUser?.id === userId) {
        setEditingUser(null);
      }
    } catch (err) {
      console.error('Failed to delete user', err);
      toast.error('Gagal menghapus pengguna');
    }
  };

  const handleDeleteUserClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!editingUser) return;
    
    handleDeleteUser(editingUser.id);
  };

  const handleUpdateRole = async (userId: string, newRole: string) => {
    try {
      await updateUser(userId, { role: newRole as any });
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole as any } : u));
      const s = await getStats();
      setStats(s);
    } catch (err) {
      console.error('Failed to update role', err);
    }
  };

  const handleEditUser = (u: User) => {
    setEditingUser(u);
    setEditForm({
      name: u.name,
      username: u.username,
      bio: u.bio || '',
      role: u.role,
      is_verified: u.is_verified || 0,
      is_approved: u.is_approved !== undefined ? u.is_approved : 1,
      password: u.password || ''
    });
  };

  const handleSaveUser = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      const updateData: any = { ...editForm };
      if (!updateData.password) {
        delete updateData.password;
      }

      await updateUser(editingUser.id, updateData);
      setUsers(users.map(u => u.id === editingUser.id ? { ...u, ...updateData } : u));
      setEditingUser(null);
      const s = await getStats();
      setStats(s);
      toast.success('Pengguna berhasil diperbarui');
    } catch (err) {
      console.error('Failed to update user', err);
      toast.error('Gagal memperbarui pengguna');
    }
  };

  const handleAddUser = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const newUser = await createUser(addUserForm);
      setUsers([newUser as User, ...users]);
      setIsAddingUser(false);
      setAddUserForm({ name: '', username: '', password: '', bio: '', role: 'voter', is_verified: 0, is_approved: 1 });
      const s = await getStats();
      setStats(s);
      toast.success('Pengguna baru berhasil ditambahkan');
    } catch (err) {
      console.error('Failed to add user', err);
      toast.error('Gagal menambahkan pengguna');
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus postingan ini?')) return;

    try {
      await deletePost(postId);
      setPosts(posts.filter(p => p.id !== postId));
      const s = await getStats();
      setStats(s);
      toast.success('Postingan berhasil dihapus');
    } catch (err) {
      console.error('Failed to delete post', err);
      toast.error('Gagal menghapus postingan');
    }
  };

  const handleDeleteCandidate = async (candidateId: string) => {
    setDeleteCandidateId(candidateId);
  };

  const confirmDeleteCandidate = async () => {
    if (!deleteCandidateId) return;

    try {
      const candidate = candidates.find(c => c.id === deleteCandidateId);
      if (candidate) {
        await removeCandidate(deleteCandidateId, candidate.user_id);
        setCandidates(candidates.filter(c => c.id !== deleteCandidateId));
        const s = await getStats();
        setStats(s);
        const u = await getAllUsers();
        setUsers(u);
        const l = await getLeaderboard();
        setLeaderboard(l);
        setDeleteCandidateId(null);
        toast.success('Kandidat berhasil dihapus');
      }
    } catch (err) {
      console.error('Failed to delete candidate', err);
      toast.error('Gagal menghapus kandidat');
    }
  };

  const handleEditCandidate = (c: Candidate) => {
    setEditingCandidate(c);
    setCandidateForm({
      name: c.name,
      username: c.username,
      avatar: c.avatar,
      vision: c.vision,
      mission: c.mission,
      innovation_program: c.innovation_program || '',
      image_url: c.image_url || ''
    });
  };

  const handleAddCandidate = () => {
    setEditingCandidate('new');
    setSelectedUserIds([]);
    setCandidateForm({
      name: '',
      username: '',
      avatar: '',
      vision: '',
      mission: '',
      innovation_program: '',
      image_url: ''
    });
  };

  const handleSaveCandidate = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingCandidate) return;

    try {
      const isNew = editingCandidate === 'new';
      
      if (isNew) {
        if (selectedUserIds.length === 0) {
          alert('Silakan pilih minimal satu pengguna');
          return;
        }
        
        for (const uid of selectedUserIds) {
            await addCandidate(uid, {
              vision: '',
              mission: '',
              innovation_program: '',
              image_url: ''
            });
        }
        fetchCandidates();
        fetchUsers();
        setEditingCandidate(null);
        fetchStats();
      } else {
        await updateCandidate((editingCandidate as Candidate).id, candidateForm);
        fetchCandidates();
        fetchUsers();
        setEditingCandidate(null);
      }
    } catch (err) {
      console.error('Failed to save candidate', err);
      alert('Terjadi kesalahan saat menyimpan kandidat');
    }
  };

  const handleResetVotes = () => {
    setShowResetConfirmation(true);
    setResetConfirmationText('');
  };

  const confirmResetVotes = async () => {
    try {
      await resetVotes();
      const s = await getStats();
      setStats(s);
      const l = await getLeaderboard();
      setLeaderboard(l);
      setShowResetConfirmation(false);
      toast.success('Data klasemen berhasil direset.');
    } catch (err) {
      console.error('Failed to reset votes', err);
      toast.error('Gagal mereset data klasemen');
    }
  };

  if (user.role !== 'admin') {
    return (
      <div className="p-8 text-center">
        <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Akses Ditolak</h1>
        <p className="text-slate-600">Anda tidak memiliki izin untuk mengakses halaman ini.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center text-white">
          <Shield className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
          <p className="text-slate-500">Kelola pengguna dan konten aplikasi</p>
        </div>
      </div>

      {/* Election Control Panel */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Kontrol Status Pemilihan</h2>
              <p className="text-sm text-slate-500">Atur tahapan pemilihan dari awal hingga akhir</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => {}}
              disabled={refreshingStatus}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
              title="Refresh Status"
            >
              <RefreshCw className={`w-4 h-4 ${refreshingStatus ? 'animate-spin' : ''}`} />
            </button>
            <button 
              onClick={resetVotes}
              disabled={resettingVotes || electionStatus === 'in_progress'}
              className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Reset Semua Suara (Hanya jika tidak sedang berlangsung)"
            >
              {resettingVotes ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
            </button>
          </div>
        </div>
        
        <div className="p-6">
          {statusMessage && (
            <div className={`mb-4 p-3 rounded-lg text-sm font-medium flex items-center gap-2 ${
              statusMessage.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {statusMessage.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
              {statusMessage.text}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Option 1: Not Started */}
            <button
              onClick={() => updateElectionStatus('not_started')}
              disabled={electionStatus === 'not_started' || updatingStatus}
              className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                electionStatus === 'not_started'
                  ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900/5'
                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              } ${updatingStatus ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`px-2 py-1 rounded text-xs font-bold ${
                  electionStatus === 'not_started' ? 'bg-slate-200 text-slate-700' : 'bg-slate-100 text-slate-500'
                }`}>
                  Tahap 1
                </span>
                {electionStatus === 'not_started' && <CheckCircle className="w-5 h-5 text-slate-900" />}
              </div>
              <h3 className={`font-bold mb-1 ${electionStatus === 'not_started' ? 'text-slate-900' : 'text-slate-600'}`}>Belum Dimulai</h3>
              <p className="text-xs text-slate-500">Pemilih hanya dapat melihat profil kandidat. Voting ditutup.</p>
            </button>

            {/* Option 2: In Progress */}
            <button
              onClick={() => updateElectionStatus('in_progress')}
              disabled={electionStatus === 'in_progress' || updatingStatus}
              className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                electionStatus === 'in_progress'
                  ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500/10'
                  : 'border-slate-200 hover:border-emerald-200 hover:bg-emerald-50/30'
              } ${updatingStatus ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`px-2 py-1 rounded text-xs font-bold ${
                  electionStatus === 'in_progress' ? 'bg-emerald-200 text-emerald-800' : 'bg-slate-100 text-slate-500'
                }`}>
                  Tahap 2
                </span>
                {electionStatus === 'in_progress' && <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
              </div>
              <h3 className={`font-bold mb-1 ${electionStatus === 'in_progress' ? 'text-emerald-900' : 'text-slate-600'}`}>Sedang Berlangsung</h3>
              <p className="text-xs text-slate-500">Voting dibuka. Pemilih dapat memberikan suara mereka.</p>
            </button>

            {/* Option 3: Closed */}
            <button
              onClick={() => updateElectionStatus('closed')}
              disabled={electionStatus === 'closed' || updatingStatus}
              className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                electionStatus === 'closed'
                  ? 'border-red-500 bg-red-50 ring-1 ring-red-500/10'
                  : 'border-slate-200 hover:border-red-200 hover:bg-red-50/30'
              } ${updatingStatus ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`px-2 py-1 rounded text-xs font-bold ${
                  electionStatus === 'closed' ? 'bg-red-200 text-red-800' : 'bg-slate-100 text-slate-500'
                }`}>
                  Tahap 3
                </span>
                {electionStatus === 'closed' && <CheckCircle className="w-5 h-5 text-red-600" />}
              </div>
              <h3 className={`font-bold mb-1 ${electionStatus === 'closed' ? 'text-red-900' : 'text-slate-600'}`}>Selesai</h3>
              <p className="text-xs text-slate-500">Voting ditutup. Hasil akhir ditampilkan di klasemen.</p>
            </button>
          </div>

          <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
            <h3 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Waktu Berakhir Pemilihan
            </h3>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="datetime-local"
                value={electionEndDate}
                onChange={(e) => setElectionEndDate(e.target.value)}
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                onClick={updateElectionEndDate}
                disabled={updatingEndDate}
                className="px-4 py-2 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {updatingEndDate ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Simpan Tanggal'}
              </button>
            </div>
          </div>

          <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
            <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
              <BarChart2 className="w-4 h-4" />
              Pengaturan Teks Klasemen
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Judul Klasemen</label>
                <input
                  type="text"
                  value={leaderboardTitle}
                  onChange={(e) => setLeaderboardTitle(e.target.value)}
                  placeholder="Contoh: Klasemen Sementara"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Deskripsi Klasemen</label>
                <input
                  type="text"
                  value={leaderboardDescription}
                  onChange={(e) => setLeaderboardDescription(e.target.value)}
                  placeholder="Contoh: Pemilihan Agen Perubahan 2024"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <button
                onClick={updateLeaderboardSettings}
                disabled={updatingLeaderboard}
                className="w-full px-4 py-2 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {updatingLeaderboard ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Simpan Pengaturan Klasemen'}
              </button>
            </div>
          </div>

          <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
            <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Pengaturan Informasi Pemilihan (Eksplor)
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Judul Informasi</label>
                <input
                  type="text"
                  value={exploreTitle}
                  onChange={(e) => setExploreTitle(e.target.value)}
                  placeholder="Contoh: Informasi Pemilihan"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Jadwal Voting</label>
                <input
                  type="text"
                  value={exploreSchedule}
                  onChange={(e) => setExploreSchedule(e.target.value)}
                  placeholder="Contoh: 1 - 15 November 2024"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Syarat Pemilih</label>
                <input
                  type="text"
                  value={exploreRequirement}
                  onChange={(e) => setExploreRequirement(e.target.value)}
                  placeholder="Contoh: Seluruh Pegawai PA Prabumulih"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Pusat Bantuan</label>
                <textarea
                  value={exploreHelp}
                  onChange={(e) => setExploreHelp(e.target.value)}
                  placeholder="Contoh: Hubungi panitia jika mengalami kendala..."
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                />
              </div>
              <button
                onClick={updateExploreSettings}
                disabled={updatingExplore}
                className="w-full px-4 py-2 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {updatingExplore ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Simpan Pengaturan Informasi'}
              </button>
            </div>
          </div>

          <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
            <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Pengaturan Teks Halaman Kandidat
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Judul Halaman Kandidat</label>
                <input
                  type="text"
                  value={candidatePageTitle}
                  onChange={(e) => setCandidatePageTitle(e.target.value)}
                  placeholder="Contoh: Daftar Kandidat"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Deskripsi Halaman Kandidat</label>
                <input
                  type="text"
                  value={candidatePageDescription}
                  onChange={(e) => setCandidatePageDescription(e.target.value)}
                  placeholder="Contoh: Berikut adalah kandidat yang akan bersaing..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <button
                onClick={updateCandidatePageSettings}
                disabled={updatingCandidatePage}
                className="w-full px-4 py-2 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {updatingCandidatePage ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Simpan Pengaturan Kandidat'}
              </button>
            </div>
          </div>

          <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
            <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Pengaturan Umum Aplikasi
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Nama Aplikasi</label>
                  <input
                    type="text"
                    value={appName}
                    onChange={(e) => setAppName(e.target.value)}
                    placeholder="Contoh: E-Voting Agen Perubahan"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Subtitle Aplikasi</label>
                  <input
                    type="text"
                    value={appSubtitle}
                    onChange={(e) => setAppSubtitle(e.target.value)}
                    placeholder="Contoh: Aplikasi Pemilihan"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Logo Aplikasi (Upload)</label>
                  <div className="flex items-center gap-4">
                    {appLogo && (
                      <div className="w-12 h-12 rounded-lg border border-slate-200 overflow-hidden bg-white shrink-0">
                        <img src={appLogo} alt="Logo Preview" className="w-full h-full object-contain" />
                      </div>
                    )}
                    <div className="flex-1">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setAppLogo(reader.result as string);
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                        className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                      />
                    </div>
                    {appLogo && (
                      <button 
                        onClick={() => setAppLogo('')}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Hapus Logo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Label Kandidat</label>
                  <input
                    type="text"
                    value={candidateLabel}
                    onChange={(e) => setCandidateLabel(e.target.value)}
                    placeholder="Contoh: Agen Perubahan"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Label Deskripsi</label>
                  <input
                    type="text"
                    value={candidateDescLabel}
                    onChange={(e) => setCandidateDescLabel(e.target.value)}
                    placeholder="Contoh: Visi & Misi"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
              <button
                onClick={updateGeneralSettings}
                disabled={updatingGeneral}
                className="w-full px-4 py-2 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {updatingGeneral ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Simpan Pengaturan Umum'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Users className="w-5 h-5" />
            </div>
            <span className="text-sm font-medium text-slate-500">Total Pengguna</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.users}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <FileText className="w-5 h-5" />
            </div>
            <span className="text-sm font-medium text-slate-500">Total Postingan</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.posts}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
              <UserCheck className="w-5 h-5" />
            </div>
            <span className="text-sm font-medium text-slate-500">Kandidat</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.candidates}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-orange-50 text-orange-600 rounded-lg">
              <BarChart2 className="w-5 h-5" />
            </div>
            <span className="text-sm font-medium text-slate-500">Total Suara</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.votes}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 font-medium text-sm transition-colors relative whitespace-nowrap ${
            activeTab === 'users' ? 'text-emerald-600' : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          Kelola Pengguna
          {activeTab === 'users' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600 rounded-t-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('posts')}
          className={`px-4 py-2 font-medium text-sm transition-colors relative whitespace-nowrap ${
            activeTab === 'posts' ? 'text-emerald-600' : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          Kelola Postingan
          {activeTab === 'posts' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600 rounded-t-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('candidates')}
          className={`px-4 py-2 font-medium text-sm transition-colors relative whitespace-nowrap ${
            activeTab === 'candidates' ? 'text-emerald-600' : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          Kelola Kandidat
          {activeTab === 'candidates' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600 rounded-t-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('leaderboard')}
          className={`px-4 py-2 font-medium text-sm transition-colors relative whitespace-nowrap ${
            activeTab === 'leaderboard' ? 'text-emerald-600' : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          Klasemen
          {activeTab === 'leaderboard' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600 rounded-t-full" />
          )}
        </button>
      </div>

      {/* Content */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {activeTab === 'users' ? (
          <div className="overflow-x-auto">
            <div className="p-4 bg-slate-50 flex justify-between items-center border-b border-slate-200">
              <h3 className="font-bold text-slate-900">Daftar Pengguna</h3>
              <button
                onClick={() => setIsAddingUser(true)}
                className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors text-sm flex items-center gap-2"
              >
                <UserPlus className="w-4 h-4" /> Tambah Pengguna
              </button>
            </div>
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Pengguna</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u, idx) => (
                  <tr key={`${u.id}-${idx}`} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <img src={u.avatar} alt={u.name} className="w-8 h-8 rounded-full object-cover" />
                        <div>
                          <div className="font-medium text-slate-900 flex items-center gap-1">
                            {u.name}
                            {u.is_verified === 1 && <CheckCircle className="w-3 h-3 text-blue-500 fill-blue-500 text-white" />}
                            {u.is_approved === 0 && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 ml-1">Belum Disetujui</span>}
                          </div>
                          <div className="text-xs text-slate-500">@{u.username}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                        u.role === 'admin' ? 'bg-slate-100 text-slate-700' :
                        u.role === 'candidate' ? 'bg-purple-100 text-purple-700' :
                        'bg-emerald-100 text-emerald-700'
                      }`}>
                        {u.role === 'admin' ? 'Admin' : u.role === 'candidate' ? 'Kandidat' : 'Voter'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleEditUser(u)}
                          className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Edit Pengguna"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        {u.id !== user.id && (
                          <button
                            onClick={() => handleDeleteUser(u.id)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Hapus Pengguna"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : activeTab === 'posts' ? (
          <div className="divide-y divide-slate-100">
            {posts.map((post, idx) => (
              <div key={`${post.id}-${idx}`} className="p-4 hover:bg-slate-50 transition-colors flex gap-4">
                <img src={post.avatar} alt={post.name} className="w-10 h-10 rounded-full object-cover shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-bold text-slate-900 text-sm">{post.name}</span>
                      <span className="text-slate-500 text-xs ml-2">@{post.username}</span>
                      <span className="text-slate-400 text-xs mx-1">•</span>
                      <span className="text-slate-400 text-xs">{formatDateWIB(post.created_at)}</span>
                    </div>
                    <button
                      onClick={() => handleDeletePost(post.id)}
                      className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                      title="Hapus Postingan"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-slate-800 text-sm mt-1 mb-2">{post.content}</p>
                  {post.image_url && (
                    <img src={post.image_url} alt="Post attachment" className="rounded-lg max-h-48 object-cover mb-2" />
                  )}
                  {post.video_url && (
                    <video src={post.video_url} controls className="rounded-lg max-h-48 object-cover mb-2 w-full" />
                  )}
                  {post.document_url && (
                    <a href={post.document_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200 hover:bg-slate-100 transition-colors mb-2">
                      <FileText className="w-5 h-5 text-emerald-600" />
                      <span className="text-sm font-medium text-slate-700 truncate">Dokumen Lampiran</span>
                    </a>
                  )}
                  {post.audio_url && (
                    <audio src={post.audio_url} controls className="w-full h-8 mb-2" />
                  )}
                  <div className="flex gap-4 text-xs text-slate-500">
                    <span>{post.likes_count} Suka</span>
                    <span>{post.comments_count} Komentar</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : activeTab === 'candidates' ? (
          <div className="divide-y divide-slate-100">
            <div className="p-4 bg-slate-50 flex justify-between items-center border-b border-slate-100">
              <h3 className="font-bold text-slate-900">Daftar Kandidat</h3>
              <button
                onClick={handleAddCandidate}
                className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors text-sm"
              >
                Tambah Kandidat
              </button>
            </div>
            {candidates.length > 0 ? candidates.map((candidate, idx) => (
              <div key={`${candidate.id}-${idx}`} className="p-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-start gap-4">
                  <img src={candidate.avatar} alt={candidate.name} className="w-12 h-12 rounded-full object-cover shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-slate-900">{candidate.name}</h3>
                        <p className="text-slate-500 text-sm">@{candidate.username}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditCandidate(candidate)}
                          className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Edit Kandidat"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteCandidate(candidate.id)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Hapus Kandidat"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                      <div className="mt-4 space-y-3">
                        <div>
                          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Program Inovasi</h4>
                          <p className="text-sm text-slate-800 italic">"{candidate.innovation_program || 'Belum ada program inovasi'}"</p>
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Visi</h4>
                          <p className="text-sm text-slate-800 whitespace-pre-wrap">{candidate.vision || 'Belum ada visi'}</p>
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Misi</h4>
                          <p className="text-sm text-slate-800 whitespace-pre-wrap">{candidate.mission || 'Belum ada misi'}</p>
                        </div>
                      </div>
                  </div>
                </div>
              </div>
            )) : (
              <div className="p-8 text-center text-slate-500">Belum ada kandidat terdaftar.</div>
            )}
          </div>
        ) : (
          <div className="p-4">
            <div className="bg-slate-50 rounded-xl p-6 border border-slate-100">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center text-orange-600">
                    <Trophy className="w-5 h-5" />
                  </div>
                  <h2 className="text-lg font-bold text-slate-900">Klasemen Perolehan Suara</h2>
                </div>
                <button
                  onClick={handleResetVotes}
                  className="px-4 py-2 bg-red-100 text-red-600 rounded-xl font-medium hover:bg-red-200 transition-colors text-sm flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" /> Reset Klasemen
                </button>
              </div>
              
              <div className="space-y-3 md:space-y-4">
                {leaderboard.length > 0 ? leaderboard.map((item, index) => {
                  const maxVotes = Math.max(...leaderboard.map(l => l.vote_count));
                  const percentage = maxVotes > 0 ? (item.vote_count / maxVotes) * 100 : 0;
                  
                  return (
                    <div key={`${item.id}-${index}`} 
                      className="bg-white p-3 md:p-4 rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:bg-slate-50 transition-colors"
                      onClick={() => handleViewVoters(item.id, item.name)}
                    >
                      <div className="flex items-center gap-3 md:gap-4 mb-2 md:mb-3">
                        <div className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center font-bold text-xs md:text-sm shrink-0 ${
                          index === 0 ? 'bg-yellow-100 text-yellow-700' :
                          index === 1 ? 'bg-slate-100 text-slate-700' :
                          index === 2 ? 'bg-orange-100 text-orange-800' :
                          'bg-slate-50 text-slate-500'
                        }`}>
                          #{index + 1}
                        </div>
                        <img src={item.avatar} alt={item.name} className="w-8 h-8 md:w-10 md:h-10 rounded-full object-cover shrink-0" />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-slate-900 text-sm md:text-base truncate">{item.name}</h3>
                          <p className="text-[10px] md:text-xs text-slate-500 truncate">@{item.username}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-lg md:text-2xl font-bold text-slate-900 leading-none">{item.vote_count}</span>
                          <span className="text-[10px] md:text-xs text-slate-500 block">Suara</span>
                        </div>
                      </div>
                      <div className="h-1.5 md:h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${
                            index === 0 ? 'bg-emerald-500' : 'bg-blue-500'
                          }`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                }) : (
                  <div className="text-center text-slate-500 py-4">Belum ada data suara.</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      {/* Add User Modal */}
      {isAddingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 sticky top-0 z-10">
              <h3 className="font-bold text-slate-900">Tambah Pengguna Baru</h3>
              <button onClick={() => setIsAddingUser(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddUser} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                  value={addUserForm.name}
                  onChange={e => setAddUserForm({...addUserForm, name: e.target.value})}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                  value={addUserForm.username}
                  onChange={e => setAddUserForm({...addUserForm, username: e.target.value})}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                <input
                  type="password"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                  value={addUserForm.password}
                  onChange={e => setAddUserForm({...addUserForm, password: e.target.value})}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Bio</label>
                <textarea
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                  value={addUserForm.bio}
                  onChange={e => setAddUserForm({...addUserForm, bio: e.target.value})}
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                  <select
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    value={addUserForm.role}
                    onChange={e => setAddUserForm({...addUserForm, role: e.target.value as any})}
                  >
                    <option value="voter">Voter</option>
                    <option value="candidate">Kandidat</option>
                    <option value="admin">Admin</option>
                    <option value="moderator">Moderator</option>
                    <option value="pengunjung">Pengunjung</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Status Verifikasi</label>
                  <select
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    value={addUserForm.is_verified}
                    onChange={e => setAddUserForm({...addUserForm, is_verified: Number(e.target.value)})}
                  >
                    <option value={0}>Belum Terverifikasi</option>
                    <option value={1}>Terverifikasi</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_approved_add"
                  checked={addUserForm.is_approved === 1}
                  onChange={e => setAddUserForm({...addUserForm, is_approved: e.target.checked ? 1 : 0})}
                  className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 border-slate-300 rounded"
                />
                <label htmlFor="is_approved_add" className="text-sm font-medium text-slate-700">Langsung Setujui Akun</label>
              </div>
              <div className="pt-4 flex gap-3 sticky bottom-0 bg-white pb-2">
                <button
                  type="button"
                  onClick={() => setIsAddingUser(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-colors"
                >
                  Tambah Pengguna
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 sticky top-0 z-10">
              <h3 className="font-bold text-slate-900">Edit Pengguna</h3>
              <button onClick={() => setEditingUser(null)} className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveUser} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                  value={editForm.name}
                  onChange={e => setEditForm({...editForm, name: e.target.value})}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                  value={editForm.username}
                  onChange={e => setEditForm({...editForm, username: e.target.value})}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                <div className="relative">
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none pr-16"
                    value={editForm.password}
                    onChange={e => setEditForm({...editForm, password: e.target.value})}
                    placeholder="Password"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
                      let pass = "";
                      for (let i = 0; i < 8; i++) {
                        pass += chars.charAt(Math.floor(Math.random() * chars.length));
                      }
                      setEditForm({...editForm, password: pass});
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded text-slate-600 font-medium transition-colors"
                  >
                    Generate
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-1">Password saat ini ditampilkan. Ubah untuk mengganti.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Bio</label>
                <textarea
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                  value={editForm.bio}
                  onChange={e => setEditForm({...editForm, bio: e.target.value})}
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                  <select
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    value={editForm.role}
                    onChange={e => setEditForm({...editForm, role: e.target.value as any})}
                  >
                    <option value="voter">Voter</option>
                    <option value="candidate">Kandidat</option>
                    <option value="admin">Admin</option>
                    <option value="moderator">Moderator</option>
                    <option value="pengunjung">Pengunjung</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Status Persetujuan Login</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditForm({...editForm, is_approved: 1})}
                      className={`flex-1 py-2 px-3 rounded-xl border text-sm font-medium transition-colors ${
                        editForm.is_approved === 1 
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-700' 
                          : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      Disetujui
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditForm({...editForm, is_approved: 0})}
                      className={`flex-1 py-2 px-3 rounded-xl border text-sm font-medium transition-colors ${
                        editForm.is_approved === 0 
                          ? 'bg-red-50 border-red-500 text-red-700' 
                          : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      Ditolak
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Status Verifikasi</label>
                  <select
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    value={editForm.is_verified}
                    onChange={e => setEditForm({...editForm, is_verified: Number(e.target.value)})}
                  >
                    <option value={0}>Belum Terverifikasi</option>
                    <option value={1}>Terverifikasi</option>
                  </select>
                </div>
              </div>
              <div className="pt-4 flex flex-col gap-3 sticky bottom-0 bg-white pb-2">
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="flex-1 py-2.5 rounded-xl border border-slate-300 font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-colors"
                  >
                    Simpan Perubahan
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleDeleteUserClick}
                  className="w-full py-2.5 rounded-xl bg-red-50 text-red-600 border border-red-200 font-bold hover:bg-red-100 transition-colors"
                >
                  Hapus Pengguna
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete User Confirmation Modal */}
      {deleteConfirmation.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <div className="p-3 bg-red-50 rounded-full">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold">Hapus Pengguna?</h3>
            </div>
            
            <p className="text-slate-600 mb-6">
              Apakah Anda yakin ingin menghapus pengguna <span className="font-bold text-slate-900">{deleteConfirmation.userName}</span>? 
              Tindakan ini akan menghapus semua data terkait (postingan, suara, dll) secara permanen dan tidak dapat dibatalkan.
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmation({ isOpen: false, userId: null, userName: '' })}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 font-bold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={processDeleteUser}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 transition-colors"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Candidate Modal */}
      {editingCandidate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 sticky top-0 z-10">
              <h3 className="font-bold text-slate-900">
                {editingCandidate === 'new' ? 'Tambah Kandidat Baru' : 'Edit Kandidat'}
              </h3>
              <button onClick={() => setEditingCandidate(null)} className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveCandidate} className="p-4 space-y-4">
              {editingCandidate === 'new' ? (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Pilih Pengguna (Bisa lebih dari satu)</label>
                  <div className="max-h-60 overflow-y-auto border border-slate-300 rounded-xl p-2 space-y-1">
                    {users.filter(u => u.role !== 'candidate').map(u => (
                      <label key={u.id} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer">
                        <input 
                            type="checkbox" 
                            checked={selectedUserIds.includes(u.id)}
                            onChange={(e) => {
                                if (e.target.checked) {
                                    setSelectedUserIds([...selectedUserIds, u.id]);
                                } else {
                                    setSelectedUserIds(selectedUserIds.filter(id => id !== u.id));
                                }
                            }}
                            className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                        />
                        <div className="flex items-center gap-2">
                            <img src={u.avatar} alt={u.name} className="w-6 h-6 rounded-full" />
                            <div>
                                <p className="text-sm font-medium text-slate-900">{u.name}</p>
                                <p className="text-xs text-slate-500">@{u.username}</p>
                            </div>
                        </div>
                      </label>
                    ))}
                    {users.filter(u => u.role !== 'candidate').length === 0 && (
                        <p className="text-sm text-slate-500 text-center py-4">Tidak ada pengguna yang tersedia untuk dijadikan kandidat.</p>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-slate-500">
                    Pengguna yang dipilih akan dipromosikan menjadi kandidat. Anda dapat melengkapi visi & misi setelah kandidat ditambahkan.
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Nama Lengkap</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                        value={candidateForm.name}
                        onChange={e => setCandidateForm({...candidateForm, name: e.target.value})}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                        value={candidateForm.username}
                        onChange={e => setCandidateForm({...candidateForm, username: e.target.value})}
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">URL Foto Profil (Opsional)</label>
                    <input
                      type="url"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                      value={candidateForm.avatar}
                      onChange={e => setCandidateForm({...candidateForm, avatar: e.target.value})}
                      placeholder="https://example.com/photo.jpg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">URL Gambar Kampanye (Opsional)</label>
                    <input
                      type="url"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                      value={candidateForm.image_url}
                      onChange={e => setCandidateForm({...candidateForm, image_url: e.target.value})}
                      placeholder="https://example.com/campaign.jpg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Visi</label>
                    <textarea
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                      value={candidateForm.vision}
                      onChange={e => setCandidateForm({...candidateForm, vision: e.target.value})}
                      rows={2}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Misi</label>
                    <textarea
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                      value={candidateForm.mission}
                      onChange={e => setCandidateForm({...candidateForm, mission: e.target.value})}
                      rows={4}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Program Inovasi</label>
                    <textarea
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                      value={candidateForm.innovation_program}
                      onChange={e => setCandidateForm({...candidateForm, innovation_program: e.target.value})}
                      rows={4}
                    />
                  </div>
                </>
              )}
              <div className="pt-4 flex gap-3 sticky bottom-0 bg-white pb-2">
                <button
                  type="button"
                  onClick={() => setEditingCandidate(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-colors"
                >
                  {editingCandidate === 'new' ? 'Tambah Kandidat' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delete Candidate Confirmation Modal */}
      {deleteCandidateId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-xl p-6">
            <div className="flex items-center gap-3 mb-4 text-red-600">
              <AlertTriangle className="w-8 h-8" />
              <h3 className="font-bold text-lg text-slate-900">Hapus Kandidat?</h3>
            </div>
            <p className="text-slate-600 mb-6">
              Apakah Anda yakin ingin menghapus kandidat ini? Tindakan ini akan menghapus semua data visi, misi, dan suara yang telah masuk untuk kandidat ini secara permanen.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteCandidateId(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 font-bold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={confirmDeleteCandidate}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 transition-colors"
              >
                Hapus Permanen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Leaderboard Confirmation Modal */}
      {showResetConfirmation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-xl p-6">
            <div className="flex items-center gap-3 mb-4 text-red-600">
              <AlertTriangle className="w-8 h-8" />
              <h3 className="font-bold text-lg text-slate-900">Reset Klasemen?</h3>
            </div>
            <p className="text-slate-600 mb-4">
              Tindakan ini akan <strong>MENGHAPUS SEMUA SUARA</strong> yang telah masuk. Data yang dihapus tidak dapat dikembalikan.
            </p>
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Ketik <strong>RESET</strong> untuk mengonfirmasi:
              </label>
              <input 
                type="text" 
                value={resetConfirmationText}
                onChange={(e) => setResetConfirmationText(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 outline-none uppercase placeholder:normal-case"
                placeholder="Ketik RESET di sini..."
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowResetConfirmation(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 font-bold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={confirmResetVotes}
                disabled={resetConfirmationText !== 'RESET'}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Reset Data
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Voters List Modal */}
      {votersModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] overflow-hidden shadow-xl flex flex-col">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-900">Daftar Pemilih</h3>
                <p className="text-xs text-slate-500">Kandidat: {votersModal.candidateName}</p>
              </div>
              <button onClick={() => setVotersModal({ ...votersModal, isOpen: false })} className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-0 overflow-y-auto flex-1">
              {loadingVoters ? (
                <div className="flex flex-col items-center justify-center py-8 text-slate-500">
                  <Loader2 className="w-8 h-8 animate-spin mb-2 text-emerald-600" />
                  <p>Memuat data...</p>
                </div>
              ) : votersModal.voters.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {votersModal.voters.map((voter, idx) => (
                    <div key={idx} className="p-3 flex items-center gap-3 hover:bg-slate-50">
                      <img src={voter.avatar} alt={voter.name} className="w-10 h-10 rounded-full object-cover" />
                      <div>
                        <div className="font-medium text-slate-900 text-sm">{voter.name}</div>
                        <div className="text-xs text-slate-500">@{voter.username}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-slate-500">
                  Belum ada pemilih untuk kandidat ini.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
