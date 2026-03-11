import { useState, useEffect, FormEvent, useRef, ChangeEvent } from 'react';
import { User, Post } from '../types';
import { Image as ImageIcon, X, Mic, Square, Play, Trash2, Clock, Video, FileText, Loader2 } from 'lucide-react';
import PostItem from '../components/PostItem';
import Stories from '../components/Stories';
import { formatDateWIB, compressImage } from '../utils';
import { createPost, listenToPosts, listenToSettings, likePost, pinPost, uploadFile } from '../lib/db';

export default function Home({ user }: { user: User }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPost, setNewPost] = useState('');
  const [loading, setLoading] = useState(true);
  
  const [imageUrl, setImageUrl] = useState('');
  const [showImageInput, setShowImageInput] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentName, setDocumentName] = useState<string | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const [electionEndDate, setElectionEndDate] = useState<Date | null>(null);
  const [timeLeft, setTimeLeft] = useState<{ days: number, hours: number, minutes: number, seconds: number } | null>(null);
  const [electionStatus, setElectionStatus] = useState<string>('not_started');

  useEffect(() => {
    const unsubscribePosts = listenToPosts((fetchedPosts) => {
      // Ensure uniqueness
      const uniquePosts = fetchedPosts.filter((post, index, self) => 
        index === self.findIndex((t) => (
          t.id === post.id
        ))
      );
      setPosts(uniquePosts);
      setLoading(false);
    });

    const unsubscribeSettings = listenToSettings((settings) => {
      if (settings.election_status) {
        setElectionStatus(settings.election_status);
      }
      if (settings.election_end_date) {
        setElectionEndDate(new Date(settings.election_end_date));
      }
    });

    return () => {
      unsubscribePosts();
      unsubscribeSettings();
    };
  }, []);

  useEffect(() => {
    if (!electionEndDate || electionStatus !== 'in_progress') {
      setTimeLeft(null);
      return;
    }

    const calculateTimeLeft = () => {
      const now = new Date();
      const difference = electionEndDate.getTime() - now.getTime();

      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60)
        });
      } else {
        setTimeLeft(null);
        setElectionStatus('closed');
      }
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(interval);
  }, [electionEndDate, electionStatus]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
        'audio/aac',
        'audio/wav'
      ];
      
      let mimeType = '';
      for (const type of mimeTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          mimeType = type;
          break;
        }
      }

      const options = mimeType ? { mimeType } : undefined;
      const mediaRecorder = new MediaRecorder(stream, options);
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const finalMimeType = mediaRecorder.mimeType || mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: finalMimeType });
        setAudioBlob(audioBlob);
        setAudioUrl(URL.createObjectURL(audioBlob));
        stream.getTracks().forEach(track => track.stop());
        
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
      };

      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);
      setRecordingDuration(0);
      
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
      
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

    } catch (err: any) {
      console.error('Error accessing microphone:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        alert('Izin mikrofon ditolak. Silakan aktifkan izin mikrofon di pengaturan browser Anda.');
      } else {
        alert('Tidak dapat mengakses mikrofon: ' + (err.message || 'Kesalahan tidak diketahui'));
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (navigator.vibrate) {
        navigator.vibrate([50, 30, 50]);
      }
    }
  };

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, []);

  const cancelAudio = () => {
    setAudioBlob(null);
    setAudioUrl(null);
  };

  const handlePost = async (e: FormEvent) => {
    e.preventDefault();
    if (!newPost.trim() && !imageUrl && !audioUrl && !videoUrl && !documentUrl) return;

    setIsPosting(true);
    try {
      let finalAudioUrl = null;
      if (audioBlob) {
        finalAudioUrl = await uploadFile(audioBlob as File);
      }

      let finalVideoUrl = videoUrl;
      if (videoFile) {
        finalVideoUrl = await uploadFile(videoFile);
      }

      let finalDocumentUrl = documentUrl;
      if (documentFile) {
        finalDocumentUrl = await uploadFile(documentFile);
      }

      // For images, if it's a data URL from compressImage, we should also upload it to be safe
      let finalImageUrl = imageUrl;
      if (imageUrl && imageUrl.startsWith('data:image')) {
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        const file = new File([blob], 'image.jpg', { type: 'image/jpeg' });
        finalImageUrl = await uploadFile(file);
      } else if (showImageInput && !imageUrl) {
        finalImageUrl = `https://picsum.photos/seed/${Math.random()}/800/600`;
      }

      await createPost({ 
        author_id: user.id, 
        content: newPost, 
        image_url: imageUrl && !imageUrl.startsWith('data:image') ? imageUrl : null,
        image_file_id: imageUrl && imageUrl.startsWith('data:image') ? finalImageUrl : null,
        video_url: videoFile ? null : finalVideoUrl,
        video_file_id: videoFile ? finalVideoUrl : null,
        document_url: documentFile ? null : finalDocumentUrl,
        document_file_id: documentFile ? finalDocumentUrl : null,
        audio_url: audioBlob ? null : finalAudioUrl,
        audio_file_id: audioBlob ? finalAudioUrl : null
      });

      setNewPost('');
      setImageUrl('');
      setShowImageInput(false);
      setVideoUrl(null);
      setVideoFile(null);
      setDocumentUrl(null);
      setDocumentFile(null);
      setDocumentName(null);
      setAudioBlob(null);
      setAudioUrl(null);
    } catch (error) {
      console.error('Error creating post:', error);
      alert('Gagal membuat postingan: ' + (error instanceof Error ? error.message : 'Kesalahan tidak diketahui'));
    } finally {
      setIsPosting(false);
    }
  };

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressedUrl = await compressImage(file);
        setImageUrl(compressedUrl);
        setShowImageInput(true);
      } catch (error) {
        console.error('Error compressing image:', error);
        alert('Gagal memproses gambar');
      }
    }
  };

  const handleVideoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setVideoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setVideoUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDocumentUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setDocumentFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setDocumentUrl(reader.result as string);
        setDocumentName(file.name);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePin = async (postId: string, isPinned: boolean) => {
    await pinPost(postId, !isPinned);
  };

  const handlePostUpdated = (updatedPost: Post) => {
    setPosts(posts.map(p => p.id === updatedPost.id ? updatedPost : p));
  };

  const handlePostDeleted = (postId: string) => {
    setPosts(posts.filter(p => p.id !== postId));
  };

  const handleLike = async (postId: string) => {
    // likePost is already handled in PostItem.tsx
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Memuat linimasa...</div>;

  return (
    <div className="w-full">
      {/* Election Status Banner */}
      <div className="p-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            <h2 className="font-bold text-lg">Status Pemilihan</h2>
          </div>
          {electionEndDate && (
            <span className="text-xs bg-white/20 px-3 py-1.5 rounded-full font-medium">
              Batas Waktu: {formatDateWIB(electionEndDate)}
            </span>
          )}
        </div>

        {electionStatus === 'not_started' && (
          <div className="text-center py-4 bg-white/10 rounded-xl border border-white/20">
            <p className="font-bold text-lg">Pemilihan Belum Dimulai</p>
            <p className="text-sm opacity-80 mt-1">Tunggu admin untuk memulai sesi pemilihan.</p>
          </div>
        )}

        {electionStatus === 'closed' && (
          <div className="text-center py-4 bg-white/10 rounded-xl border border-white/20">
            <p className="font-bold text-lg">Pemilihan Telah Berakhir</p>
            <p className="text-sm opacity-80 mt-1">Terima kasih atas partisipasi Anda.</p>
          </div>
        )}

        {electionStatus === 'in_progress' && timeLeft && (
          <div className="grid grid-cols-4 gap-3 text-center">
            <div className="bg-white/20 rounded-xl p-3 border border-white/10 shadow-sm">
              <div className="text-3xl font-bold">{timeLeft.days}</div>
              <div className="text-xs font-medium uppercase tracking-wider opacity-90 mt-1">Hari</div>
            </div>
            <div className="bg-white/20 rounded-xl p-3 border border-white/10 shadow-sm">
              <div className="text-3xl font-bold">{timeLeft.hours}</div>
              <div className="text-xs font-medium uppercase tracking-wider opacity-90 mt-1">Jam</div>
            </div>
            <div className="bg-white/20 rounded-xl p-3 border border-white/10 shadow-sm">
              <div className="text-3xl font-bold">{timeLeft.minutes}</div>
              <div className="text-xs font-medium uppercase tracking-wider opacity-90 mt-1">Menit</div>
            </div>
            <div className="bg-white/20 rounded-xl p-3 border border-white/10 shadow-sm">
              <div className="text-3xl font-bold">{timeLeft.seconds}</div>
              <div className="text-xs font-medium uppercase tracking-wider opacity-90 mt-1">Detik</div>
            </div>
          </div>
        )}
      </div>

      {/* Stories Section (Mobile Only) */}
      <div className="lg:hidden bg-white border-b border-slate-200 py-2">
        <Stories user={user} />
      </div>

      {/* Create Post Section */}
      <div className="p-3 md:p-4 border-b border-slate-200 bg-white">
        <div className="flex gap-3 md:gap-4">
          <img src={user.avatar || 'https://picsum.photos/seed/avatar/48/48'} alt={user.name} className="w-10 h-10 md:w-12 md:h-12 rounded-full hidden sm:block" />
          <form onSubmit={handlePost} className="flex-1">
            <textarea
              value={newPost}
              onChange={(e) => setNewPost(e.target.value)}
              placeholder="Apa yang ingin Anda sampaikan tentang pemilihan ini?"
              className="w-full bg-transparent resize-none outline-none text-base md:text-lg placeholder:text-slate-400 min-h-[60px] md:min-h-[80px]"
            />
            
            {showImageInput && (
              <div className="mb-3 relative">
                {imageUrl.startsWith('data:image') ? (
                  <div className="relative inline-block">
                    <img src={imageUrl || null} alt="Preview" className="max-h-48 rounded-xl object-cover" />
                    <button 
                      type="button" 
                      onClick={() => { setShowImageInput(false); setImageUrl(''); }}
                      className="absolute top-2 right-2 p-1 bg-black/50 text-white rounded-full hover:bg-black/70"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      type="text"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      placeholder="Masukkan URL gambar (opsional, biarkan kosong untuk gambar acak)"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    />
                    <button 
                      type="button" 
                      onClick={() => { setShowImageInput(false); setImageUrl(''); }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 bg-slate-100 rounded-full"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            )}

            {videoUrl && (
              <div className="mb-3 relative inline-block">
                <video src={videoUrl || undefined} controls className="max-h-48 rounded-xl bg-black" />
                <button 
                  type="button" 
                  onClick={() => setVideoUrl(null)}
                  className="absolute top-2 right-2 p-1 bg-black/50 text-white rounded-full hover:bg-black/70"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {documentUrl && (
              <div className="mb-3 relative inline-flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="p-2 bg-white rounded-lg border border-slate-200">
                  <FileText className="w-6 h-6 text-slate-500" />
                </div>
                <div className="flex-1 min-w-0 pr-8">
                  <p className="font-medium text-slate-900 truncate">{documentName || 'Dokumen'}</p>
                  <p className="text-xs text-slate-500">Siap diunggah</p>
                </div>
                <button 
                  type="button" 
                  onClick={() => { setDocumentUrl(null); setDocumentName(null); }}
                  className="absolute top-2 right-2 p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {isRecording && (
              <div className="mb-3 flex items-center gap-3 bg-red-50 text-red-600 px-4 py-3 rounded-2xl border border-red-100 shadow-sm animate-pulse">
                <div className="relative flex items-center justify-center">
                  <div className="absolute w-4 h-4 bg-red-400 rounded-full animate-ping" />
                  <div className="relative w-3 h-3 rounded-full bg-red-600" />
                </div>
                <div className="flex-1">
                  <span className="text-sm font-bold block">Merekam...</span>
                  <span className="text-xs font-mono opacity-80">{formatDuration(recordingDuration)}</span>
                </div>
                <button
                  type="button"
                  onClick={stopRecording}
                  className="p-2 bg-red-600 text-white hover:bg-red-700 rounded-xl transition-all shadow-md active:scale-90"
                >
                  <Square className="w-4 h-4 fill-current" />
                </button>
              </div>
            )}

            {audioUrl && !isRecording && (
              <div className="mb-3 flex items-center gap-3 bg-emerald-50 px-4 py-3 rounded-2xl border border-emerald-100 shadow-sm">
                <div className="p-2 bg-emerald-100 text-emerald-600 rounded-full">
                  <Mic className="w-4 h-4" />
                </div>
                <audio src={audioUrl || undefined} controls className="h-8 flex-1" />
                <button
                  type="button"
                  onClick={cancelAudio}
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 md:pt-3 border-t border-slate-100">
              <div className="flex gap-2">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleImageUpload} 
                  accept="image/*" 
                  className="hidden" 
                />
                <input 
                  type="file" 
                  ref={videoInputRef} 
                  onChange={handleVideoUpload} 
                  accept="video/*" 
                  className="hidden" 
                />
                <input 
                  type="file" 
                  ref={documentInputRef} 
                  onChange={handleDocumentUpload} 
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt" 
                  className="hidden" 
                />
                <button 
                  type="button" 
                  onClick={() => fileInputRef.current?.click()}
                  className={`p-3 md:p-2.5 rounded-full transition-all active:scale-95 touch-manipulation ${showImageInput ? 'text-emerald-600 bg-emerald-50 ring-2 ring-emerald-100' : 'text-slate-500 hover:bg-slate-50 hover:text-emerald-600'}`}
                  title="Unggah Gambar"
                >
                  <ImageIcon className="w-6 h-6 md:w-6 md:h-6" />
                </button>
                <button 
                  type="button" 
                  onClick={() => videoInputRef.current?.click()}
                  className={`p-3 md:p-2.5 rounded-full transition-all active:scale-95 touch-manipulation ${videoUrl ? 'text-emerald-600 bg-emerald-50 ring-2 ring-emerald-100' : 'text-slate-500 hover:bg-slate-50 hover:text-emerald-600'}`}
                  title="Unggah Video"
                >
                  <Video className="w-6 h-6 md:w-6 md:h-6" />
                </button>
                <button 
                  type="button" 
                  onClick={() => documentInputRef.current?.click()}
                  className={`p-3 md:p-2.5 rounded-full transition-all active:scale-95 touch-manipulation ${documentUrl ? 'text-emerald-600 bg-emerald-50 ring-2 ring-emerald-100' : 'text-slate-500 hover:bg-slate-50 hover:text-emerald-600'}`}
                  title="Unggah Dokumen"
                >
                  <FileText className="w-6 h-6 md:w-6 md:h-6" />
                </button>
                <button 
                  type="button" 
                  onClick={isRecording ? stopRecording : startRecording}
                  className={`p-3 md:p-2.5 rounded-full transition-all active:scale-95 touch-manipulation ${isRecording ? 'text-white bg-red-600 ring-4 ring-red-100 scale-110' : audioUrl ? 'text-red-600 bg-red-50 ring-2 ring-red-100' : 'text-slate-500 hover:bg-slate-50 hover:text-red-600'}`}
                  title={isRecording ? "Hentikan Rekaman" : "Rekam Suara"}
                >
                  <Mic className={`w-6 h-6 md:w-6 md:h-6 ${isRecording ? 'animate-pulse' : ''}`} />
                </button>
              </div>
              <button
                type="submit"
                disabled={(!newPost.trim() && !imageUrl && !audioUrl && !videoUrl && !documentUrl) || isRecording || isPosting}
                className="bg-emerald-600 text-white px-4 md:px-6 py-1.5 md:py-2 rounded-full font-bold text-sm hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {isPosting && <Loader2 className="w-4 h-4 animate-spin" />}
                {isPosting ? 'Memposting...' : 'Posting'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Feed */}
      <div className="divide-y divide-slate-100">
        {posts.map((post) => (
          <PostItem 
            key={post.id} 
            post={post} 
            user={user} 
            onLike={handleLike} 
            onPin={handlePin}
            onPostUpdated={handlePostUpdated}
            onPostDeleted={handlePostDeleted}
          />
        ))}
      </div>
    </div>
  );
}
