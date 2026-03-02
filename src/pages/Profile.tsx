import { useState, useEffect, FormEvent, ChangeEvent, MouseEvent, TouchEvent } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { User, Post, Candidate } from '../types';
import { Settings, Edit3, MapPin, Briefcase, Info, X, Camera, MessageSquare, CheckCircle, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import PostItem from '../components/PostItem';

export default function Profile({ user: currentUser, onUpdateUser }: { user: User, onUpdateUser?: (user: User) => void }) {
  const { userId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'posts' | 'campaign'>('posts');
  const [candidateData, setCandidateData] = useState<Candidate | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ 
    name: '', username: '', avatar: '', cover_url: '',
    bio: '', location: '',
    cover_position: '50% 50%', avatar_position: '50% 50%'
  });
  const [coverPos, setCoverPos] = useState({ x: 50, y: 50 });
  const [avatarPos, setAvatarPos] = useState({ x: 50, y: 50 });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');
  const [isEditingCampaign, setIsEditingCampaign] = useState(false);
  const [campaignForm, setCampaignForm] = useState({ vision: '', mission: '', innovation_program: '', image_url: '' });
  const [campaignLoading, setCampaignLoading] = useState(false);

  const isOwnProfile = !userId || Number(userId) === currentUser.id;
  const targetUserId = isOwnProfile ? currentUser.id : Number(userId);

  let canEditProfile = false;
  if (profileUser) {
    if (currentUser.role === 'admin') {
      canEditProfile = true;
    } else if (isOwnProfile) {
      canEditProfile = true;
    }
  }

  const canEditCampaign = currentUser.role === 'admin' || (isOwnProfile && profileUser?.role === 'candidate');

  useEffect(() => {
    window.scrollTo(0, 0);
    setLoading(true);
    setProfileUser(null); // Force reset to trigger second effect reliably
    
    if (isOwnProfile) {
      // Use a small delay or next tick to ensure state transition is clean
      const timer = setTimeout(() => {
        setProfileUser({ ...currentUser });
      }, 0);
      return () => clearTimeout(timer);
    } else {
      fetch('/api/users')
        .then(res => res.json())
        .then((users: User[]) => {
          const found = users.find(u => u.id === targetUserId);
          if (found) {
            setProfileUser(found);
          } else {
            setLoading(false);
          }
        })
        .catch(() => setLoading(false));
    }
  }, [targetUserId, isOwnProfile, currentUser, location.pathname]);

  const fetchPosts = () => {
    fetch(`/api/posts?userId=${currentUser.id}`)
      .then(res => res.json())
      .then(data => {
        const userPosts = data.filter((post: Post) => post.author_id === targetUserId);
        setPosts(userPosts);
        setLoading(false);
      });
  };

  useEffect(() => {
    if (!profileUser) return;
    
    fetchPosts();
    if (profileUser.role === 'candidate') {
      fetch('/api/candidates')
        .then(res => res.json())
        .then((data: Candidate[]) => {
          const found = data.find(c => c.user_id === profileUser.id);
          if (found) {
            setCandidateData(found);
            setCampaignForm({ 
              vision: found.vision || '', 
              mission: found.mission || '',
              innovation_program: found.innovation_program || '',
              image_url: found.image_url || ''
            });
          }
        });
    }
  }, [profileUser, targetUserId]);

  const handlePostUpdated = (updatedPost: Post) => {
    setPosts(posts.map(p => p.id === updatedPost.id ? updatedPost : p));
  };

  const handlePostDeleted = (postId: number) => {
    setPosts(posts.filter(p => p.id !== postId));
  };

  const handleLike = async (postId: number) => {
    await fetch(`/api/posts/${postId}/like`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUser.id }),
    });
    fetchPosts();
  };

  const handlePin = async (postId: number, isPinned: boolean) => {
    await fetch(`/api/admin/posts/${postId}/pin`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_pinned: !isPinned }),
    });
    fetchPosts();
  };

  const handleEditSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setEditLoading(true);
    setEditError('');

    try {
      const finalForm = {
        ...editForm,
        cover_position: `${coverPos.x}% ${coverPos.y}%`,
        avatar_position: `${avatarPos.x}% ${avatarPos.y}%`
      };

      const res = await fetch(`/api/users/${profileUser?.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalForm),
      });

      let data;
      try {
        data = await res.json();
      } catch (e) {
        throw new Error('Gagal memperbarui profil: Respons server tidak valid');
      }

      if (!res.ok) throw new Error(data.error || 'Gagal memperbarui profil');

      setProfileUser(data);
      if (onUpdateUser && isOwnProfile) {
        onUpdateUser(data);
      }
      toast.success('Profil berhasil diperbarui!');
      setShowEditModal(false);
    } catch (err: any) {
      setEditError(err.message);
    } finally {
      setEditLoading(false);
    }
  };

  const openEditModal = () => {
    if (profileUser) {
      const cPos = profileUser.cover_position ? profileUser.cover_position.split(' ') : ['50%', '50%'];
      const aPos = profileUser.avatar_position ? profileUser.avatar_position.split(' ') : ['50%', '50%'];
      
      setCoverPos({ 
        x: parseFloat(cPos[0]) || 50, 
        y: parseFloat(cPos[1]) || 50 
      });
      setAvatarPos({ 
        x: parseFloat(aPos[0]) || 50, 
        y: parseFloat(aPos[1]) || 50 
      });

      setEditForm({ 
        name: profileUser.name, 
        username: profileUser.username, 
        avatar: profileUser.avatar,
        cover_url: profileUser.cover_url || '',
        bio: profileUser.bio || '',
        location: profileUser.location || '',
        cover_position: profileUser.cover_position || '50% 50%',
        avatar_position: profileUser.avatar_position || '50% 50%'
      });
      setShowEditModal(true);
    }
  };

  const [touchStart, setTouchStart] = useState({ x: 0, y: 0 });

  const handleCoverDrag = (e: MouseEvent) => {
    if (e.buttons !== 1) return;
    setCoverPos(prev => ({
      x: Math.max(0, Math.min(100, prev.x - e.movementX * 0.2)),
      y: Math.max(0, Math.min(100, prev.y - e.movementY * 0.2))
    }));
  };

  const handleCoverTouchStart = (e: TouchEvent) => {
    setTouchStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
  };

  const handleCoverTouchMove = (e: TouchEvent) => {
    const touch = e.touches[0];
    const movementX = touch.clientX - touchStart.x;
    const movementY = touch.clientY - touchStart.y;
    
    setCoverPos(prev => ({
      x: Math.max(0, Math.min(100, prev.x - movementX * 0.2)),
      y: Math.max(0, Math.min(100, prev.y - movementY * 0.2))
    }));
    setTouchStart({ x: touch.clientX, y: touch.clientY });
  };

  const handleAvatarDrag = (e: MouseEvent) => {
    if (e.buttons !== 1) return;
    setAvatarPos(prev => ({
      x: Math.max(0, Math.min(100, prev.x - e.movementX * 0.5)),
      y: Math.max(0, Math.min(100, prev.y - e.movementY * 0.5))
    }));
  };

  const handleAvatarTouchStart = (e: TouchEvent) => {
    setTouchStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
  };

  const handleAvatarTouchMove = (e: TouchEvent) => {
    const touch = e.touches[0];
    const movementX = touch.clientX - touchStart.x;
    const movementY = touch.clientY - touchStart.y;
    
    setAvatarPos(prev => ({
      x: Math.max(0, Math.min(100, prev.x - movementX * 0.5)),
      y: Math.max(0, Math.min(100, prev.y - movementY * 0.5))
    }));
    setTouchStart({ x: touch.clientX, y: touch.clientY });
  };

  const handleCampaignImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Ukuran file maksimal 5MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setCampaignForm(prev => ({ ...prev, image_url: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCampaignSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setCampaignLoading(true);
    try {
      const res = await fetch(`/api/candidates/${profileUser?.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(campaignForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memperbarui kampanye');
      setCandidateData(data);
      setIsEditingCampaign(false);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCampaignLoading(false);
    }
  };

  const handleStartMessage = async () => {
    if (!profileUser) return;
    
    // Check if conversation exists or just redirect to messages with a state
    // For simplicity, we'll just redirect to messages and let the user pick or we could pass the user id
    // But let's try to make it better by sending a "ping" message if it's new, or just redirecting.
    // Actually, the Messages page can handle a "start with" state.
    navigate('/messages', { state: { startWith: profileUser } });
  };

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>, field: 'avatar' | 'cover_url') => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setEditError('Ukuran file maksimal 5MB');
        return;
      }
      setEditError('');
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditForm(prev => ({ ...prev, [field]: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  if (!profileUser) return <div className="p-8 text-center text-slate-500">Memuat profil...</div>;

  return (
    <div className="w-full min-h-screen bg-slate-50">
      {/* Cover Image */}
      <div 
        className="h-48 bg-gradient-to-r from-emerald-500 to-teal-600 relative bg-cover bg-no-repeat"
        style={profileUser.cover_url ? { 
          backgroundImage: `url(${profileUser.cover_url})`,
          backgroundPosition: profileUser.cover_position || '50% 50%'
        } : {}}
      >
        <div className="absolute inset-0 bg-black/10"></div>
      </div>

      {/* Profile Info */}
      <div className="px-4 md:px-6 pb-6 relative">
        <div className="flex flex-col sm:flex-row justify-between items-center sm:items-end -mt-12 sm:-mt-16 mb-4 gap-4">
          <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full border-4 border-white shadow-md relative z-10 bg-white overflow-hidden">
            <img
              src={profileUser.avatar}
              alt={profileUser.name}
              className="w-full h-full object-cover"
              style={{ objectPosition: profileUser.avatar_position || '50% 50%' }}
            />
          </div>
          {canEditProfile ? (
            <button onClick={openEditModal} className="w-full sm:w-auto px-4 py-2 rounded-full border border-slate-300 font-bold text-slate-700 hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 bg-white shadow-sm text-sm sm:text-base">
              <Edit3 className="w-4 h-4" /> Edit Profil
            </button>
          ) : (
            <button 
              onClick={handleStartMessage}
              className="w-full sm:w-auto px-6 py-2 rounded-full bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 shadow-sm text-sm sm:text-base"
            >
              <MessageSquare className="w-4 h-4" /> Kirim Pesan
            </button>
          )}
        </div>

        <div className="text-center sm:text-left">
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center justify-center sm:justify-start gap-1">
            {profileUser.name}
            {profileUser.is_verified === 1 && <CheckCircle className="w-5 h-5 text-blue-500 fill-blue-500 text-white" />}
          </h1>
          <p className="text-sm sm:text-base text-slate-500 font-medium">@{profileUser.username}</p>
        </div>

        <div className="mt-4 text-sm sm:text-base text-slate-800 leading-relaxed max-w-2xl text-center sm:text-left">
          <p>{profileUser.bio || 'Pegawai Pengadilan Agama Prabumulih. Berkomitmen untuk memberikan pelayanan terbaik bagi masyarakat pencari keadilan.'}</p>
        </div>

        <div className="mt-6 flex flex-wrap justify-center sm:justify-start gap-3 sm:gap-4 text-xs sm:text-sm text-slate-500 font-medium">
          <div className="flex items-center gap-1.5">
            <Briefcase className="w-4 h-4 text-slate-400" />
            <span className="capitalize">{profileUser.role}</span>
          </div>
          {profileUser.location && (
            <div className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-slate-400" />
              <span>{profileUser.location}</span>
            </div>
          )}
        </div>

        <div className="mt-8 flex gap-4 sm:gap-6 border-b border-slate-200">
          <button 
            onClick={() => setActiveTab('posts')}
            className={`pb-3 sm:pb-4 font-bold px-2 transition-colors text-sm sm:text-base ${activeTab === 'posts' ? 'border-b-2 border-emerald-600 text-emerald-600' : 'text-slate-500 hover:text-slate-900'}`}
          >
            Postingan
          </button>
          {profileUser.role === 'candidate' && (
            <button 
              onClick={() => setActiveTab('campaign')}
              className={`pb-3 sm:pb-4 font-bold px-2 transition-colors text-sm sm:text-base ${activeTab === 'campaign' ? 'border-b-2 border-emerald-600 text-emerald-600' : 'text-slate-500 hover:text-slate-900'}`}
            >
              Kampanye
            </button>
          )}
        </div>

        <div className="py-4">
          {activeTab === 'posts' ? (
            loading ? (
              <div className="text-center text-slate-500 py-8">Memuat postingan...</div>
            ) : posts.length > 0 ? (
              <div className="divide-y divide-slate-100 bg-white rounded-2xl border border-slate-200 overflow-hidden">
                {posts.map((post) => (
                  <PostItem 
                    key={post.id} 
                    post={post} 
                    user={currentUser} 
                    onLike={handleLike} 
                    onPin={handlePin}
                    onCommentAdded={fetchPosts}
                    onPostUpdated={handlePostUpdated}
                    onPostDeleted={handlePostDeleted}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center text-slate-500 py-12">
                <p>Belum ada postingan.</p>
              </div>
            )
          ) : (
            candidateData && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
                {isEditingCampaign ? (
                  <form onSubmit={handleCampaignSubmit} className="space-y-6">
                    <div>
                      <h4 className="font-bold text-slate-900 uppercase tracking-wider text-sm mb-3">Foto Kampanye (Opsional)</h4>
                      <div 
                        className="w-full h-48 rounded-xl bg-slate-50 border-2 border-dashed border-slate-300 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-100 transition-colors relative overflow-hidden"
                        onClick={() => document.getElementById('campaign-image-upload')?.click()}
                      >
                        {campaignForm.image_url ? (
                          <>
                            <img src={campaignForm.image_url} alt="Campaign" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                              <Camera className="w-8 h-8 text-white" />
                            </div>
                          </>
                        ) : (
                          <>
                            <ImageIcon className="w-8 h-8 text-slate-400 mb-2" />
                            <span className="text-sm text-slate-500 font-medium">Klik untuk unggah foto</span>
                          </>
                        )}
                        <input 
                          id="campaign-image-upload" 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={handleCampaignImageUpload}
                        />
                      </div>
                      {campaignForm.image_url && (
                        <button 
                          type="button"
                          onClick={() => setCampaignForm(prev => ({ ...prev, image_url: '' }))}
                          className="text-red-500 text-sm font-bold mt-2 hover:underline"
                        >
                          Hapus Foto
                        </button>
                      )}
                    </div>

                    <div className="bg-emerald-50 rounded-2xl p-5 border border-emerald-100">
                      <h4 className="font-bold text-emerald-900 uppercase tracking-wider text-sm mb-3 flex items-center gap-2">
                        <Info className="w-4 h-4" /> Edit Program Inovasi
                      </h4>
                      <textarea
                        required
                        value={campaignForm.innovation_program}
                        onChange={e => setCampaignForm({ ...campaignForm, innovation_program: e.target.value })}
                        className="w-full bg-white border border-emerald-200 rounded-xl px-4 py-3 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-emerald-900 font-medium min-h-[100px]"
                        placeholder="Masukkan program inovasi Anda..."
                      />
                    </div>

                    <div>
                      <h4 className="font-bold text-slate-900 uppercase tracking-wider text-sm mb-3">Edit Visi</h4>
                      <textarea
                        required
                        value={campaignForm.vision}
                        onChange={e => setCampaignForm({ ...campaignForm, vision: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-slate-700 min-h-[200px] whitespace-pre-wrap"
                        placeholder="Masukkan visi Anda..."
                      />
                    </div>

                    <div>
                      <h4 className="font-bold text-slate-900 uppercase tracking-wider text-sm mb-3">Edit Misi</h4>
                      <textarea
                        required
                        value={campaignForm.mission}
                        onChange={e => setCampaignForm({ ...campaignForm, mission: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-slate-700 min-h-[150px] whitespace-nowrap"
                        placeholder="Masukkan misi Anda..."
                      />
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setIsEditingCampaign(false)}
                        className="flex-1 px-4 py-2 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        disabled={campaignLoading}
                        className="flex-1 px-4 py-2 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors disabled:opacity-50"
                      >
                        {campaignLoading ? 'Menyimpan...' : 'Simpan Perubahan'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    {candidateData.image_url && (
                      <div className="mb-6 rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
                        <img src={candidateData.image_url} alt="Campaign" className="w-full h-auto object-cover max-h-[400px]" />
                      </div>
                    )}

                    <div className="flex justify-between items-start mb-2">
                      <div className="bg-emerald-50 rounded-2xl p-5 border border-emerald-100 flex-1">
                        <h4 className="font-bold text-emerald-900 uppercase tracking-wider text-sm mb-2 flex items-center gap-2">
                          <Info className="w-4 h-4" /> Program Inovasi
                        </h4>
                        <p className="text-emerald-800 font-medium leading-relaxed">"{candidateData.innovation_program || 'Belum ada program inovasi'}"</p>
                      </div>
                      {canEditCampaign && (
                        <button 
                          onClick={() => setIsEditingCampaign(true)}
                          className="ml-4 p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-full transition-colors"
                          title="Edit Kampanye"
                        >
                          <Edit3 className="w-5 h-5" />
                        </button>
                      )}
                    </div>

                    <div>
                      <h4 className="font-bold text-slate-900 uppercase tracking-wider text-sm mb-3">Visi</h4>
                      <div className="prose prose-slate prose-sm max-w-none">
                        <p className="whitespace-pre-wrap text-slate-700 leading-relaxed">{candidateData.vision || 'Belum ada visi'}</p>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-bold text-slate-900 uppercase tracking-wider text-sm mb-3">Misi</h4>
                      <div className="prose prose-slate prose-sm max-w-none">
                        <p className="whitespace-pre-wrap text-slate-700 leading-relaxed">{candidateData.mission || 'Belum ada misi'}</p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )
          )}
        </div>
      </div>

      {/* Edit Profile Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-xl">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-lg text-slate-900">Edit Profil</h3>
              <button onClick={() => setShowEditModal(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {editError && (
                <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-medium">
                  {editError}
                </div>
              )}

              {/* Cover Image Upload */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Latar Belakang Profil</label>
                <div 
                  className="h-32 rounded-xl bg-slate-100 border-2 border-dashed border-slate-300 relative flex items-center justify-center overflow-hidden group cursor-move bg-no-repeat"
                  style={editForm.cover_url ? { 
                    backgroundImage: `url(${editForm.cover_url})`,
                    backgroundPosition: `${coverPos.x}% ${coverPos.y}%`,
                    backgroundSize: 'cover'
                  } : {}}
                  onMouseMove={handleCoverDrag}
                  onTouchStart={handleCoverTouchStart}
                  onTouchMove={handleCoverTouchMove}
                >
                  {editForm.cover_url ? (
                    <>
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        <div className="text-center text-white">
                          <p className="text-xs font-bold mb-2">Geser untuk menyesuaikan</p>
                          <button 
                            type="button"
                            onClick={(e) => { e.stopPropagation(); document.getElementById('cover-upload')?.click(); }}
                            className="bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg backdrop-blur-sm transition-colors pointer-events-auto"
                          >
                            Ganti Foto
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div 
                      className="text-center text-slate-500 w-full h-full flex flex-col items-center justify-center cursor-pointer"
                      onClick={() => document.getElementById('cover-upload')?.click()}
                    >
                      <Camera className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                      <span className="text-sm font-medium">Klik untuk unggah foto</span>
                    </div>
                  )}
                  <input 
                    id="cover-upload" 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={(e) => handleImageUpload(e, 'cover_url')}
                  />
                </div>
              </div>

              {/* Avatar Upload */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Foto Profil</label>
                <div className="flex items-center gap-4">
                  <div 
                    className="w-20 h-20 rounded-full bg-slate-100 border-2 border-dashed border-slate-300 relative flex items-center justify-center overflow-hidden group cursor-move shrink-0"
                    onMouseMove={handleAvatarDrag}
                    onTouchStart={handleAvatarTouchStart}
                    onTouchMove={handleAvatarTouchMove}
                  >
                    {editForm.avatar ? (
                      <>
                        <img 
                          src={editForm.avatar} 
                          alt="Avatar" 
                          className="w-full h-full object-cover pointer-events-none" 
                          style={{ objectPosition: `${avatarPos.x}% ${avatarPos.y}%` }}
                        />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          <button 
                            type="button"
                            onClick={(e) => { e.stopPropagation(); document.getElementById('avatar-upload')?.click(); }}
                            className="pointer-events-auto"
                          >
                            <Camera className="w-6 h-6 text-white" />
                          </button>
                        </div>
                      </>
                    ) : (
                      <div 
                        className="w-full h-full flex items-center justify-center cursor-pointer"
                        onClick={() => document.getElementById('avatar-upload')?.click()}
                      >
                        <Camera className="w-6 h-6 text-slate-400" />
                      </div>
                    )}
                    <input 
                      id="avatar-upload" 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={(e) => handleImageUpload(e, 'avatar')}
                    />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-slate-500 mb-2">Unggah foto profil baru atau geser foto untuk menyesuaikan posisi.</p>
                  </div>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={e => setEditForm({...editForm, name: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Username</label>
                <input
                  type="text"
                  required
                  value={editForm.username}
                  onChange={e => setEditForm({...editForm, username: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Lokasi</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={editForm.location}
                    disabled
                    className="w-full bg-slate-100 border border-slate-200 rounded-xl pl-10 pr-4 py-2 outline-none text-slate-500 cursor-not-allowed"
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1">Lokasi tidak dapat diubah.</p>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Bio / Keterangan</label>
                <textarea
                  value={editForm.bio}
                  onChange={e => setEditForm({...editForm, bio: e.target.value})}
                  placeholder="Pegawai Pengadilan Agama Prabumulih..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 min-h-[80px] resize-y"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 px-4 py-2 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="flex-1 px-4 py-2 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  {editLoading ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
