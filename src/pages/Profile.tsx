import React, { useState, useEffect, FormEvent, ChangeEvent, MouseEvent, TouchEvent, useRef } from 'react';
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { User, Post, Candidate, GalleryImage } from '../types';
import { Settings, Edit3, MapPin, Briefcase, Info, X, Camera, MessageSquare, CheckCircle, Image as ImageIcon, Trash2, Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import PostItem from '../components/PostItem';
import { getUser, listenToPosts, getCandidates, updateUser, updateCandidate, likePost, pinPost, addGalleryImage, listenToGalleryImages, updateGalleryImageCaption, deleteGalleryImage, uploadFile, getFileFromChunks } from '../lib/db';
import { compressImage } from '../utils';

interface GalleryImageItemProps {
  key?: string | number;
  image: GalleryImage;
  isOwnProfile: boolean;
  onEdit: (img: GalleryImage) => void;
  onDelete: (id: string) => Promise<void>;
  onClick: () => void;
}

function GalleryImageItem({ image, isOwnProfile, onEdit, onDelete, onClick }: GalleryImageItemProps) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    getFileFromChunks(image.image_file_id).then(setUrl);
  }, [image.image_file_id]);
  
  if (!url) return <div className="aspect-square bg-slate-200 animate-pulse rounded-2xl" />;
  
  return (
    <div className="group relative aspect-square rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 cursor-pointer" onClick={onClick}>
      <img src={url} alt={image.caption} className="w-full h-full object-cover" />
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
        <p className="text-white text-sm font-medium truncate">{image.caption}</p>
        {isOwnProfile && (
          <div className="flex gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => onEdit(image)} className="p-2 bg-white/20 rounded-lg text-white hover:bg-white/40">
              <Edit3 className="w-4 h-4" />
            </button>
            <button onClick={() => onDelete(image.id)} className="p-2 bg-red-500/20 rounded-lg text-red-200 hover:bg-red-500/40">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Profile({ user: currentUser, onUpdateUser }: { user: User, onUpdateUser?: (user: User) => void }) {
  const { userId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get('tab') as 'posts' | 'campaign' | 'gallery') || 'posts';

  const setActiveTab = (tab: 'posts' | 'campaign' | 'gallery') => {
    setSearchParams({ tab });
  };

  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([]);
  const [isUploadingGallery, setIsUploadingGallery] = useState(false);
  const [galleryUploadProgress, setGalleryUploadProgress] = useState(0);
  const [selectedGalleryImage, setSelectedGalleryImage] = useState<GalleryImage | null>(null);
  const [selectedGalleryImageUrl, setSelectedGalleryImageUrl] = useState<string | null>(null);
  const [isEditingGalleryCaption, setIsEditingGalleryCaption] = useState(false);
  const [galleryCaptionInput, setGalleryCaptionInput] = useState('');
  const galleryFileInputRef = useRef<HTMLInputElement>(null);

  const [candidateData, setCandidateData] = useState<Candidate | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ 
    name: '', username: '', avatar: '', cover_url: '',
    bio: '', location: '',
    cover_position: '50% 50%', avatar_position: '50% 50%',
    password: ''
  });
  const [coverPos, setCoverPos] = useState({ x: 50, y: 50 });
  const [avatarPos, setAvatarPos] = useState({ x: 50, y: 50 });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');
  const [isEditingCampaign, setIsEditingCampaign] = useState(false);
  const [campaignForm, setCampaignForm] = useState({ vision: '', mission: '', innovation_program: '', image_url: '' });
  const [campaignLoading, setCampaignLoading] = useState(false);

  const isOwnProfile = !userId || userId === currentUser.id;
  const targetUserId = isOwnProfile ? currentUser.id : userId as string;

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
    
    const fetchProfile = async () => {
      if (isOwnProfile) {
        setProfileUser({ ...currentUser });
      } else {
        try {
          const user = await getUser(targetUserId);
          if (user) {
            setProfileUser(user);
          } else {
            setLoading(false);
          }
        } catch (err) {
          console.error(err);
          setLoading(false);
        }
      }
    };

    fetchProfile();
  }, [targetUserId, isOwnProfile, currentUser, location.pathname]);

  useEffect(() => {
    if (!profileUser) return;
    
    const unsubscribePosts = listenToPosts((allPosts) => {
      const userPosts = allPosts.filter(p => p.author_id === targetUserId);
      // Ensure uniqueness
      const uniquePosts = userPosts.filter((post, index, self) => 
        index === self.findIndex((t) => (
          t.id === post.id
        ))
      );
      setPosts(uniquePosts);
      setLoading(false);
    });

    if (profileUser.role === 'candidate') {
      getCandidates().then(candidates => {
        const found = candidates.find(c => c.user_id === profileUser.id);
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

    const unsubscribeGallery = listenToGalleryImages(targetUserId, (images) => {
      setGalleryImages(images);
    });

    return () => {
      unsubscribePosts();
      unsubscribeGallery();
    };
  }, [profileUser, targetUserId, currentUser.id]);

  const handlePostUpdated = (updatedPost: Post) => {
    setPosts(posts.map(p => p.id === updatedPost.id ? updatedPost : p));
  };

  const handlePostDeleted = (postId: string) => {
    setPosts(posts.filter(p => p.id !== postId));
  };

  const handleLike = async (postId: string) => {
    try {
      // likePost is already handled in PostItem.tsx
    } catch (err) {
      console.error(err);
    }
  };

  const handlePin = async (postId: string, isPinned: boolean) => {
    try {
      await pinPost(postId, !isPinned);
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setEditLoading(true);
    setEditError('');

    try {
      const finalForm: any = {
        ...editForm,
        cover_position: `${coverPos.x}% ${coverPos.y}%`,
        avatar_position: `${avatarPos.x}% ${avatarPos.y}%`
      };

      if (!finalForm.password) {
        delete finalForm.password;
      }

      await updateUser(profileUser!.id, finalForm);

      const updatedUser = { ...profileUser!, ...finalForm };
      setProfileUser(updatedUser);
      if (onUpdateUser && isOwnProfile) {
        onUpdateUser(updatedUser);
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
        avatar_position: profileUser.avatar_position || '50% 50%',
        password: ''
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

  const handleGalleryUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) {
      toast.error('Hanya gambar yang diperbolehkan');
      return;
    }

    setIsUploadingGallery(true);
    setGalleryUploadProgress(0);

    try {
      const compressed = await compressImage(file);
      const url = await uploadFile(file, (progress) => setGalleryUploadProgress(progress));
      await addGalleryImage(currentUser.id, url, '');
      toast.success('Gambar berhasil diunggah');
    } catch (err) {
      console.error(err);
      toast.error('Gagal mengunggah gambar');
    } finally {
      setIsUploadingGallery(false);
      setGalleryUploadProgress(0);
      if (galleryFileInputRef.current) galleryFileInputRef.current.value = '';
    }
  };

  const handleUpdateCaption = async () => {
    if (!selectedGalleryImage) return;
    try {
      await updateGalleryImageCaption(selectedGalleryImage.id, galleryCaptionInput);
      toast.success('Caption diperbarui');
      setIsEditingGalleryCaption(false);
      setSelectedGalleryImage(null);
    } catch (err) {
      console.error(err);
      toast.error('Gagal memperbarui caption');
    }
  };

  const handleDeleteImage = async (imageId: string) => {
    if (!confirm('Hapus gambar ini?')) return;
    try {
      await deleteGalleryImage(imageId);
      toast.success('Gambar dihapus');
      if (selectedGalleryImage?.id === imageId) {
        setSelectedGalleryImage(null);
      }
    } catch (err) {
      console.error(err);
      toast.error('Gagal menghapus gambar');
    }
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

  const handleCampaignImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressedUrl = await compressImage(file);
        setCampaignForm(prev => ({ ...prev, image_url: compressedUrl }));
      } catch (error) {
        console.error('Error compressing image:', error);
        toast.error('Gagal memproses gambar');
      }
    }
  };

  const handleCampaignSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!candidateData) return;
    
    setCampaignLoading(true);
    try {
      await updateCandidate(candidateData.id, campaignForm);
      setCandidateData({ ...candidateData, ...campaignForm });
      setIsEditingCampaign(false);
      toast.success('Informasi kampanye berhasil diperbarui');
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Gagal memperbarui kampanye');
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

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>, field: 'avatar' | 'cover_url') => {
    const file = e.target.files?.[0];
    if (file) {
      setEditError('');
      try {
        const compressedUrl = await compressImage(file);
        setEditForm(prev => ({ ...prev, [field]: compressedUrl }));
      } catch (error) {
        console.error('Error compressing image:', error);
        setEditError('Gagal memproses gambar');
      }
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
              src={profileUser.avatar || 'https://picsum.photos/seed/avatar/48/48'}
              alt={profileUser.name}
              className="w-full h-full object-cover"
              style={{ objectPosition: profileUser.avatar_position || '50% 50%' }}
            />
          </div>
          {canEditProfile ? (
            <div className="flex gap-2">
              {currentUser.role === 'admin' && profileUser.is_approved === 0 && (
                <button 
                  onClick={async () => {
                    await updateUser(profileUser.id, { is_approved: 1 });
                    setProfileUser({ ...profileUser, is_approved: 1 });
                    toast.success('Akun berhasil disetujui');
                  }}
                  className="px-4 py-2 rounded-full bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 shadow-sm text-sm sm:text-base"
                >
                  <CheckCircle className="w-4 h-4" /> Setujui Akun
                </button>
              )}
              <button onClick={openEditModal} className="w-full sm:w-auto px-4 py-2 rounded-full border border-slate-300 font-bold text-slate-700 hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 bg-white shadow-sm text-sm sm:text-base">
                <Edit3 className="w-4 h-4" /> Edit Profil
              </button>
            </div>
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
          <button 
            onClick={() => setActiveTab('gallery')}
            className={`pb-3 sm:pb-4 font-bold px-2 transition-colors text-sm sm:text-base ${activeTab === 'gallery' ? 'border-b-2 border-emerald-600 text-emerald-600' : 'text-slate-500 hover:text-slate-900'}`}
          >
            Galeri
          </button>
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
          ) : activeTab === 'gallery' ? (
            <div className="space-y-6">
              {isOwnProfile && (
                <div className="bg-white rounded-2xl border border-slate-200 p-6">
                  <button
                    onClick={() => galleryFileInputRef.current?.click()}
                    disabled={isUploadingGallery}
                    className="w-full py-4 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center gap-2 text-slate-500 hover:border-emerald-500 hover:text-emerald-600 transition-colors"
                  >
                    {isUploadingGallery ? (
                      <Loader2 className="w-8 h-8 animate-spin" />
                    ) : (
                      <Upload className="w-8 h-8" />
                    )}
                    <span className="font-bold">
                      {isUploadingGallery ? `Mengunggah... ${galleryUploadProgress}%` : 'Unggah Gambar ke Galeri'}
                    </span>
                  </button>
                  <input
                    type="file"
                    ref={galleryFileInputRef}
                    onChange={handleGalleryUpload}
                    accept="image/*"
                    className="hidden"
                  />
                </div>
              )}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {galleryImages.map((image) => (
                  <GalleryImageItem 
                    key={image.id} 
                    image={image} 
                    isOwnProfile={isOwnProfile} 
                    onEdit={(img) => { setSelectedGalleryImage(img); setGalleryCaptionInput(img.caption); setIsEditingGalleryCaption(true); }}
                    onDelete={handleDeleteImage}
                    onClick={async () => {
                      const url = await getFileFromChunks(image.image_file_id);
                      setSelectedGalleryImageUrl(url);
                      setSelectedGalleryImage(image);
                    }}
                  />
                ))}
              </div>
              {selectedGalleryImage && !isEditingGalleryCaption && (
                <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => { setSelectedGalleryImage(null); setSelectedGalleryImageUrl(null); }}>
                  <button onClick={() => { setSelectedGalleryImage(null); setSelectedGalleryImageUrl(null); }} className="absolute top-4 right-4 p-2 bg-white/20 rounded-full text-white hover:bg-white/40">
                    <X className="w-8 h-8" />
                  </button>
                  {selectedGalleryImageUrl && (
                    <img src={selectedGalleryImageUrl} alt="Zoom" className="max-w-full max-h-full object-contain" />
                  )}
                </div>
              )}
              {isEditingGalleryCaption && selectedGalleryImage && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                  <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
                    <h3 className="font-bold text-lg mb-4">Edit Caption</h3>
                    <input
                      type="text"
                      value={galleryCaptionInput}
                      onChange={(e) => setGalleryCaptionInput(e.target.value)}
                      className="w-full border border-slate-300 rounded-xl px-4 py-2 mb-4"
                      placeholder="Masukkan caption..."
                    />
                    <div className="flex gap-2">
                      <button onClick={() => setIsEditingGalleryCaption(false)} className="flex-1 px-4 py-2 rounded-xl bg-slate-100">Batal</button>
                      <button onClick={handleUpdateCaption} className="flex-1 px-4 py-2 rounded-xl bg-emerald-600 text-white">Simpan</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
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
                            <img src={campaignForm.image_url || undefined} alt="Campaign" className="w-full h-full object-cover" />
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
                        <img src={candidateData.image_url || undefined} alt="Campaign" className="w-full h-auto object-cover max-h-[400px]" />
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
                          src={editForm.avatar || 'https://picsum.photos/seed/avatar/48/48'} 
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
                <label className="block text-sm font-bold text-slate-700 mb-1">Password</label>
                <input
                  type="text"
                  value={editForm.password || ''}
                  onChange={e => setEditForm({...editForm, password: e.target.value})}
                  placeholder="Kosongkan jika tidak ingin mengubah"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
                <p className="text-xs text-slate-400 mt-1">Isi untuk mengganti password.</p>
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
