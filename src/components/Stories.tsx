import { useState, useEffect, useRef, ChangeEvent } from 'react';
import { User, Story } from '../types';
import { Plus, X, Image as ImageIcon, Video as VideoIcon, Camera, Type, AtSign, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface StoryGroup {
  user_id: number;
  user_name: string;
  user_avatar: string;
  stories: Story[];
}

function StoryViewer({
  storyGroups,
  initialGroupIndex,
  onClose,
  currentUser
}: {
  storyGroups: StoryGroup[];
  initialGroupIndex: number;
  onClose: () => void;
  currentUser: User;
}) {
  const [groupIndex, setGroupIndex] = useState(initialGroupIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  
  const currentGroup = storyGroups[groupIndex];
  const currentStory = currentGroup.stories[storyIndex];
  const videoRef = useRef<HTMLVideoElement>(null);

  const [showViewers, setShowViewers] = useState(false);

  const handleNext = () => {
    if (storyIndex < currentGroup.stories.length - 1) {
      setStoryIndex(prev => prev + 1);
      setProgress(0);
    } else if (groupIndex < storyGroups.length - 1) {
      setGroupIndex(prev => prev + 1);
      setStoryIndex(0);
      setProgress(0);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (storyIndex > 0) {
      setStoryIndex(prev => prev - 1);
      setProgress(0);
    } else if (groupIndex > 0) {
      setGroupIndex(prev => prev - 1);
      setStoryIndex(storyGroups[groupIndex - 1].stories.length - 1);
      setProgress(0);
    }
  };

  useEffect(() => {
    setProgress(0);
    let animationFrame: number;
    let startTime: number;
    const duration = currentStory.media_type === 'image' ? 5000 : 0;

    const animate = (timestamp: number) => {
      if (isPaused) {
        startTime += timestamp - lastTimestamp;
      } else {
        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;
        if (duration > 0) {
          const newProgress = Math.min((elapsed / duration) * 100, 100);
          setProgress(newProgress);
          if (newProgress >= 100) {
            handleNext();
            return;
          }
        }
      }
      lastTimestamp = timestamp;
      animationFrame = requestAnimationFrame(animate);
    };

    let lastTimestamp = performance.now();
    if (currentStory.media_type === 'image') {
      animationFrame = requestAnimationFrame(animate);
    }

    return () => cancelAnimationFrame(animationFrame);
  }, [currentStory, isPaused]);

  const handleVideoTimeUpdate = () => {
    if (videoRef.current && !isPaused) {
      const { currentTime, duration } = videoRef.current;
      if (duration) {
        setProgress((currentTime / duration) * 100);
      }
    }
  };

  useEffect(() => {
    if (videoRef.current) {
      if (isPaused) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(() => {});
      }
    }
  }, [isPaused, currentStory]);

  useEffect(() => {
    // Record view if not the author
    if (currentStory.user_id !== currentUser.id) {
      fetch(`/api/stories/${currentStory.id}/view`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: currentUser.id })
      }).catch(console.error);
    }
  }, [currentStory.id, currentUser.id]);

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center"
    >
      <button onClick={onClose} className="absolute top-4 right-4 text-white p-2 z-[60] bg-black/50 rounded-full hover:bg-black/80 transition-colors flex items-center gap-2 px-4">
        <X className="w-5 h-5" />
        <span className="text-sm font-medium">Tutup</span>
      </button>
      
      <div 
        className="w-full max-w-md h-full sm:h-[90vh] sm:rounded-2xl overflow-hidden relative bg-slate-900 flex items-center justify-center"
        onMouseDown={() => setIsPaused(true)}
        onMouseUp={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
      >
        {/* Progress Bars */}
        <div className="absolute top-0 left-0 right-0 p-2 z-20 flex gap-1">
          {currentGroup.stories.map((_, idx) => (
            <div key={idx} className="h-1 flex-1 bg-white/30 rounded-full overflow-hidden">
              <div 
                className="h-full bg-white transition-all duration-100 ease-linear"
                style={{ width: `${idx < storyIndex ? 100 : idx === storyIndex ? progress : 0}%` }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-0 left-0 right-0 pt-6 px-4 pb-4 bg-gradient-to-b from-black/60 to-transparent z-10 flex items-center gap-3">
          <img src={currentGroup.user_avatar} alt={currentGroup.user_name} className="w-10 h-10 rounded-full border border-white/20" />
          <div>
            <p className="text-white font-bold text-sm">{currentGroup.user_name}</p>
            <p className="text-white/70 text-xs">{new Date(currentStory.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</p>
          </div>
        </div>

        {/* Tap Areas */}
        <div className="absolute inset-0 z-10 flex">
          <div className="w-1/3 h-full cursor-pointer" onClick={(e) => { e.stopPropagation(); handlePrev(); }} />
          <div className="w-2/3 h-full cursor-pointer" onClick={(e) => { e.stopPropagation(); handleNext(); }} />
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStory.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.2 }}
            className="w-full h-full flex items-center justify-center relative"
          >
            {currentStory.media_type === 'video' ? (
              <video 
                ref={videoRef}
                src={currentStory.media_url} 
                autoPlay 
                playsInline
                onEnded={handleNext}
                onTimeUpdate={handleVideoTimeUpdate}
                className="w-full h-full object-contain" 
              />
            ) : (
              <img 
                src={currentStory.media_url} 
                alt="Story" 
                className="w-full h-full object-cover" 
              />
            )}

            {/* Text Overlays */}
            {currentStory.text_overlays?.map((overlay, idx) => (
              <div 
                key={idx}
                className={`absolute flex items-center justify-center pointer-events-none`}
                style={{
                  transform: `translate(${overlay.x}px, ${overlay.y}px)`
                }}
              >
                <div 
                  className={`text-center px-4 py-2 rounded-lg ${overlay.font}`}
                  style={{ color: overlay.color, textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}
                >
                  <span className="text-2xl md:text-4xl font-bold break-words">{overlay.text}</span>
                </div>
              </div>
            ))}

            {/* Tags */}
            {currentStory.tags && currentStory.tags.length > 0 && (
              <>
                {currentStory.tags.map(tag => (
                  <div 
                    key={tag.id} 
                    className="absolute bg-black/50 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-1 backdrop-blur-sm z-20"
                    style={{
                      transform: `translate(${tag.x || 0}px, ${tag.y || 0}px)`
                    }}
                  >
                    <AtSign className="w-3 h-3" />
                    {tag.username}
                  </div>
                ))}
              </>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Viewers Button (Author Only) */}
        {currentStory.user_id === currentUser.id && (
          <div className="absolute bottom-4 left-0 right-0 flex justify-center z-30">
            <button 
              onClick={(e) => { e.stopPropagation(); setShowViewers(true); setIsPaused(true); }}
              className="flex items-center gap-2 bg-black/50 text-white px-4 py-2 rounded-full backdrop-blur-sm hover:bg-black/70 transition-colors"
            >
              <Eye className="w-4 h-4" />
              <span className="text-sm font-medium">{currentStory.views?.length || 0} Tayangan</span>
            </button>
          </div>
        )}

        {/* Viewers Modal */}
        <AnimatePresence>
          {showViewers && (
            <motion.div 
              initial={{ opacity: 0, y: '100%' }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: '100%' }}
              className="absolute inset-x-0 bottom-0 top-1/2 bg-slate-900 rounded-t-2xl z-40 flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b border-slate-800 flex justify-between items-center">
                <h3 className="text-white font-bold flex items-center gap-2">
                  <Eye className="w-5 h-5" />
                  Tayangan ({currentStory.views?.length || 0})
                </h3>
                <button onClick={() => { setShowViewers(false); setIsPaused(false); }} className="text-slate-400 hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 pb-8 md:pb-4">
                {currentStory.views?.length === 0 ? (
                  <p className="text-slate-400 text-center mt-4">Belum ada yang melihat cerita ini.</p>
                ) : (
                  <div className="flex flex-col gap-4">
                    {currentStory.views?.map(viewer => (
                      <div key={viewer.id} className="flex items-center gap-3">
                        <img src={viewer.avatar} alt={viewer.name} className="w-10 h-10 rounded-full" />
                        <div>
                          <p className="text-white font-medium">{viewer.name}</p>
                          <p className="text-slate-400 text-xs">{new Date(viewer.viewed_at).toLocaleString('id-ID')}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export default function Stories({ user }: { user: User }) {
  const [stories, setStories] = useState<Story[]>([]);
  const [activeStoryGroupIndex, setActiveStoryGroupIndex] = useState<number | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMedia, setUploadMedia] = useState<{ url: string, type: 'image' | 'video' } | null>(null);
  
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  
  // Text Overlay State
  const [textOverlay, setTextOverlay] = useState<{ text: string, font: string, color: string, x: number, y: number } | null>(null);
  const [isEditingText, setIsEditingText] = useState(false);
  const [tempText, setTempText] = useState('');
  const [tempFont, setTempFont] = useState('font-sans');
  const [tempColor, setTempColor] = useState('#ffffff');
  
  // Tagging State
  const [taggedUsers, setTaggedUsers] = useState<{id: number, username: string, name: string, x: number, y: number}[]>([]);
  const [isTagging, setIsTagging] = useState(false);
  const [tagSearch, setTagSearch] = useState('');
  const [tagSuggestions, setTagSuggestions] = useState<User[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    fetchStories();
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}`);
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'story:created') {
        setStories(prev => [data.story, ...prev]);
      }
    };
    return () => ws.close();
  }, []);

  const fetchStories = async () => {
    try {
      const res = await fetch('/api/stories');
      const data = await res.json();
      setStories(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 10 * 1024 * 1024) {
      alert('Ukuran file maksimal 10MB');
      return;
    }

    const isVideo = file.type.startsWith('video/');
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setUploadMedia({ url: event.target.result as string, type: isVideo ? 'video' : 'image' });
        setShowUpload(true);
      }
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };
    reader.onerror = () => {
      alert('Gagal membaca file. Silakan coba lagi.');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setShowCamera(false);
  };

  const startCamera = async (mode = facingMode) => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: mode,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }, 
        audio: true 
      });
      setCameraStream(stream);
      setFacingMode(mode);
      setShowCamera(true);
    } catch (e) {
      console.error('Error accessing camera:', e);
      alert('Gagal mengakses kamera. Pastikan Anda telah memberikan izin.');
    }
  };

  const toggleCamera = () => {
    startCamera(facingMode === 'user' ? 'environment' : 'user');
  };

  useEffect(() => {
    if (showCamera && videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [showCamera, cameraStream]);

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Mirror if using front camera
        if (facingMode === 'user') {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(videoRef.current, 0, 0);
        const url = canvas.toDataURL('image/jpeg');
        setUploadMedia({ url, type: 'image' });
        stopCamera();
        setShowUpload(true);
      }
    }
  };

  const startRecording = () => {
    if (cameraStream) {
      const mediaRecorder = new MediaRecorder(cameraStream);
      mediaRecorderRef.current = mediaRecorder;
      const chunks: BlobPart[] = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        setUploadMedia({ url, type: 'video' });
        stopCamera();
        setShowUpload(true);
      };

      mediaRecorder.start();
      setIsRecording(true);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const searchUsers = async (query: string) => {
    if (!query) {
      setTagSuggestions([]);
      return;
    }
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setTagSuggestions(data.users);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (isTagging) searchUsers(tagSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [tagSearch, isTagging]);

  const handleUpload = async () => {
    if (!uploadMedia || isUploading) return;
    
    setIsUploading(true);
    try {
      const res = await fetch('/api/stories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          media_url: uploadMedia.url,
          media_type: uploadMedia.type,
          text_overlays: textOverlay ? [textOverlay] : [],
          tags: taggedUsers
        })
      });
      
      if (!res.ok) {
        throw new Error('Failed to upload');
      }
      
      setShowUpload(false);
      setUploadMedia(null);
      setTextOverlay(null);
      setTaggedUsers([]);
      fetchStories();
    } catch (e) {
      console.error(e);
      alert('Gagal mengunggah cerita. Silakan coba lagi.');
    } finally {
      setIsUploading(false);
    }
  };

  const groupedStories = stories.reduce((acc, story) => {
    if (!acc[story.user_id]) {
      acc[story.user_id] = {
        user_id: story.user_id,
        user_name: story.user_name,
        user_avatar: story.user_avatar,
        stories: []
      };
    }
    acc[story.user_id].stories.push(story);
    return acc;
  }, {} as Record<number, StoryGroup>);

  const storyGroups: StoryGroup[] = Object.values(groupedStories);

  return (
    <div className="w-full py-2">
      <div className="flex gap-4 overflow-x-auto pb-2 px-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {/* Add Story Button */}
        <div className="flex flex-col items-center gap-1 shrink-0 cursor-pointer" onClick={() => setShowCamera(true)}>
          <div className="relative">
            <img src={user.avatar} alt={user.name} className="w-16 h-16 rounded-full object-cover border-2 border-slate-200 p-0.5" />
            <div className="absolute bottom-0 right-0 bg-emerald-500 text-white rounded-full p-1 border-2 border-white">
              <Plus className="w-3 h-3" />
            </div>
          </div>
          <span className="text-xs font-medium text-slate-600">Buat Cerita</span>
        </div>

        {/* Story List */}
        {storyGroups.map((group, index) => (
          <div key={group.user_id} className="flex flex-col items-center gap-1 shrink-0 cursor-pointer" onClick={() => {
            setActiveStoryGroupIndex(index);
          }}>
            <div className="w-16 h-16 rounded-full p-0.5 bg-gradient-to-tr from-yellow-400 to-fuchsia-600">
              <img src={group.user_avatar} alt={group.user_name} className="w-full h-full rounded-full object-cover border-2 border-white" />
            </div>
            <span className="text-xs font-medium text-slate-600 truncate w-16 text-center">{group.user_name.split(' ')[0]}</span>
          </div>
        ))}
      </div>

      {/* Camera Modal */}
      <AnimatePresence>
        {showCamera && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black flex flex-col"
          >
            <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-10">
              <button onClick={stopCamera} className="text-white p-2 bg-black/50 rounded-full hover:bg-black/80 transition-colors">
                <X className="w-6 h-6" />
              </button>
              <div className="flex gap-2">
                <button onClick={toggleCamera} className="text-white p-2 bg-black/50 rounded-full hover:bg-black/80 transition-colors">
                  <Camera className="w-5 h-5" />
                </button>
                <button onClick={() => fileInputRef.current?.click()} className="text-white p-2 bg-black/50 rounded-full hover:bg-black/80 transition-colors flex items-center gap-2">
                  <ImageIcon className="w-5 h-5" />
                  <span className="text-sm font-medium">Galeri</span>
                </button>
              </div>
              <input type="file" accept="image/*,video/*" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
            </div>
            
            <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
              {!cameraStream && (
                <div className="text-center">
                  <button onClick={startCamera} className="px-6 py-3 bg-emerald-500 text-white rounded-full font-bold flex items-center gap-2 mx-auto mb-4">
                    <Camera className="w-5 h-5" />
                    Buka Kamera
                  </button>
                  <p className="text-white/70 text-sm">Atau pilih dari galeri</p>
                </div>
              )}
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted 
                className={`w-full h-full object-cover ${cameraStream ? 'block' : 'hidden'}`} 
                style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
              />
            </div>
            
            {cameraStream && (
              <div className="h-32 bg-black flex items-center justify-center pb-8 md:pb-0">
                <button 
                  onClick={capturePhoto}
                  onMouseDown={startRecording}
                  onMouseUp={stopRecording}
                  onTouchStart={startRecording}
                  onTouchEnd={stopRecording}
                  className={`w-20 h-20 rounded-full border-4 border-white flex items-center justify-center transition-all ${isRecording ? 'bg-red-500 scale-110' : 'bg-transparent'}`}
                >
                  <div className={`w-16 h-16 rounded-full ${isRecording ? 'bg-red-500' : 'bg-white'}`} />
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upload Modal */}
      <AnimatePresence>
        {showUpload && uploadMedia && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4"
          >
            <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-[60]">
              <button onClick={() => setShowUpload(false)} className="text-white p-2 bg-black/50 rounded-full hover:bg-black/80 transition-colors flex items-center gap-2 px-4">
                <X className="w-5 h-5" />
                <span className="text-sm font-medium">Batal</span>
              </button>
              <div className="flex gap-2">
                <button onClick={() => setIsEditingText(true)} className="text-white p-2 bg-black/50 rounded-full hover:bg-black/80 transition-colors">
                  <Type className="w-5 h-5" />
                </button>
                <button onClick={() => setIsTagging(true)} className="text-white p-2 bg-black/50 rounded-full hover:bg-black/80 transition-colors">
                  <AtSign className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="w-full h-full md:h-auto md:max-w-md bg-slate-900 md:rounded-2xl overflow-hidden shadow-2xl flex flex-col md:max-h-[85vh] relative">
              <div className="flex-1 min-h-0 bg-black relative flex items-center justify-center">
                {uploadMedia.type === 'video' ? (
                  <video src={uploadMedia.url} controls className="w-full h-full object-contain" />
                ) : (
                  <img src={uploadMedia.url} alt="Preview" className="w-full h-full object-cover" />
                )}
                
                {/* Text Overlay Display */}
                {textOverlay && !isEditingText && (
                  <motion.div 
                    drag
                    dragMomentum={false}
                    onDragEnd={(e, info) => {
                      setTextOverlay({
                        ...textOverlay,
                        x: textOverlay.x + info.offset.x,
                        y: textOverlay.y + info.offset.y
                      });
                    }}
                    className={`absolute flex items-center justify-center cursor-move z-30`}
                    animate={{ x: textOverlay.x, y: textOverlay.y }}
                    style={{ touchAction: 'none' }}
                  >
                    <div 
                      className={`text-center px-4 py-2 rounded-lg ${textOverlay.font}`}
                      style={{ color: textOverlay.color, textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}
                    >
                      <span className="text-2xl md:text-4xl font-bold break-words">{textOverlay.text}</span>
                    </div>
                  </motion.div>
                )}

                {/* Tagged Users Display */}
                {taggedUsers.length > 0 && (
                  <>
                    {taggedUsers.map((tag, idx) => (
                      <motion.div 
                        key={tag.id}
                        drag
                        dragMomentum={false}
                        onDragEnd={(e, info) => {
                          const newTags = [...taggedUsers];
                          newTags[idx] = {
                            ...tag,
                            x: tag.x + info.offset.x,
                            y: tag.y + info.offset.y
                          };
                          setTaggedUsers(newTags);
                        }}
                        className="absolute bg-black/50 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-1 cursor-move z-30 backdrop-blur-sm"
                        animate={{ x: tag.x, y: tag.y }}
                        style={{ touchAction: 'none' }}
                      >
                        <AtSign className="w-3 h-3" />
                        {tag.username}
                      </motion.div>
                    ))}
                  </>
                )}
              </div>
              <div className="p-4 pb-8 md:pb-4 flex justify-end shrink-0 bg-slate-900 border-t border-slate-800">
                <button 
                  onClick={handleUpload} 
                  disabled={isUploading}
                  className="px-6 py-2 bg-emerald-500 text-white font-bold rounded-full hover:bg-emerald-600 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  {isUploading ? 'Mengunggah...' : 'Upload Story'}
                </button>
              </div>
            </div>

            {/* Text Editor Overlay */}
            {isEditingText && (
              <div className="absolute inset-0 z-[70] bg-black/80 flex flex-col">
                <div className="p-4 flex justify-between items-center">
                  <button onClick={() => setIsEditingText(false)} className="text-white">Batal</button>
                  <button 
                    onClick={() => {
                      if (tempText.trim()) {
                        setTextOverlay({ 
                          text: tempText, 
                          font: tempFont, 
                          color: tempColor,
                          x: textOverlay?.x || 0,
                          y: textOverlay?.y || 0
                        });
                      } else {
                        setTextOverlay(null);
                      }
                      setIsEditingText(false);
                    }} 
                    className="text-emerald-400 font-bold"
                  >
                    Selesai
                  </button>
                </div>
                <div className="flex-1 flex items-center justify-center p-4">
                  <textarea
                    autoFocus
                    value={tempText}
                    onChange={(e) => setTempText(e.target.value)}
                    className={`w-full bg-transparent text-center text-3xl md:text-5xl font-bold resize-none outline-none ${tempFont}`}
                    style={{ color: tempColor, textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}
                    placeholder="Ketik sesuatu..."
                    rows={3}
                  />
                </div>
                <div className="p-4 pb-8 md:pb-4 bg-slate-900 flex flex-col gap-4">
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {['#ffffff', '#000000', '#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'].map(color => (
                      <button 
                        key={color}
                        onClick={() => setTempColor(color)}
                        className={`w-8 h-8 rounded-full shrink-0 border-2 ${tempColor === color ? 'border-white' : 'border-transparent'}`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {['font-sans', 'font-serif', 'font-mono'].map(font => (
                      <button 
                        key={font}
                        onClick={() => setTempFont(font)}
                        className={`px-4 py-2 rounded-full shrink-0 text-sm font-medium ${tempFont === font ? 'bg-white text-black' : 'bg-slate-800 text-white'}`}
                      >
                        {font.replace('font-', '')}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Tagging Overlay */}
            {isTagging && (
              <div className="absolute inset-0 z-[70] bg-slate-900 flex flex-col">
                <div className="p-4 flex gap-3 items-center border-b border-slate-800">
                  <button onClick={() => setIsTagging(false)} className="text-white">
                    <X className="w-6 h-6" />
                  </button>
                  <input
                    autoFocus
                    type="text"
                    value={tagSearch}
                    onChange={(e) => setTagSearch(e.target.value)}
                    placeholder="Cari pengguna untuk ditandai..."
                    className="flex-1 bg-slate-800 text-white rounded-full px-4 py-2 outline-none"
                  />
                </div>
                <div className="flex-1 overflow-y-auto p-4 pb-8 md:pb-4">
                  {tagSuggestions.map(u => (
                    <div 
                      key={u.id} 
                      className="flex items-center gap-3 p-3 hover:bg-slate-800 rounded-xl cursor-pointer"
                      onClick={() => {
                        if (!taggedUsers.find(t => t.id === u.id)) {
                          setTaggedUsers([...taggedUsers, {
                            id: u.id,
                            username: u.username,
                            name: u.name,
                            x: 0,
                            y: 0
                          }]);
                        }
                        setIsTagging(false);
                        setTagSearch('');
                      }}
                    >
                      <img src={u.avatar} alt={u.name} className="w-10 h-10 rounded-full" />
                      <div>
                        <p className="text-white font-medium">{u.name}</p>
                        <p className="text-slate-400 text-sm">@{u.username}</p>
                      </div>
                    </div>
                  ))}
                  {tagSuggestions.length === 0 && tagSearch && (
                    <p className="text-center text-slate-400 mt-4">Tidak ada pengguna ditemukan</p>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Story Viewer Modal */}
      <AnimatePresence>
        {activeStoryGroupIndex !== null && (
          <StoryViewer 
            storyGroups={storyGroups} 
            initialGroupIndex={activeStoryGroupIndex} 
            onClose={() => setActiveStoryGroupIndex(null)} 
            currentUser={user}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
