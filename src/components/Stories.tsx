import { useState, useEffect, useRef, ChangeEvent } from 'react';
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { User, Story } from '../types';
import { Plus, X, Image as ImageIcon, Video as VideoIcon, Camera, Type, AtSign, Eye, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatDateWIB, compressImage } from '../utils';
import { clsx } from 'clsx';
import { toast } from 'sonner';
import { createStory, listenToStories, deleteStory, search, viewStory, uploadFile, getFileFromChunks } from '../lib/db';

interface StoryGroup {
  user_id: string;
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
  
  // Keep track of the last valid story so we don't render a blank screen while closing
  const [lastValidStory, setLastValidStory] = useState<Story | null>(null);
  const [lastValidGroup, setLastValidGroup] = useState<StoryGroup | null>(null);

  const currentGroup = storyGroups[groupIndex];
  const currentStory = currentGroup?.stories[storyIndex];

  useEffect(() => {
    if (currentGroup && currentStory) {
      setLastValidGroup(currentGroup);
      setLastValidStory(currentStory);
    }
  }, [currentGroup, currentStory]);

  useEffect(() => {
    // If the current group no longer exists
    if (!storyGroups[groupIndex]) {
      if (groupIndex < storyGroups.length) {
        // A group was deleted, but another shifted into its place
        setStoryIndex(0);
      } else {
        // We were at the last group, and it was deleted or we are out of bounds
        onClose();
      }
      return;
    }

    // If the current story no longer exists in this group
    if (!storyGroups[groupIndex].stories[storyIndex]) {
      if (storyIndex < storyGroups[groupIndex].stories.length) {
        // A story was deleted, but another shifted into its place. Do nothing.
      } else if (storyGroups[groupIndex].stories.length > 0) {
        // We deleted the last story in the group. Move to next group if it exists.
        if (groupIndex < storyGroups.length - 1) {
          setGroupIndex(groupIndex + 1);
          setStoryIndex(0);
        } else {
          onClose();
        }
      }
    }
  }, [storyGroups, groupIndex, storyIndex, onClose]);

  const displayGroup = currentGroup || lastValidGroup;
  const displayStory = currentStory || lastValidStory;

  if (!displayGroup || !displayStory) {
    return null;
  }

  const videoRef = useRef<HTMLVideoElement>(null);

  const [showViewers, setShowViewers] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [mediaUrl, setMediaUrl] = useState<string | null>(displayStory.media_url || null);
  const [isLoadingMedia, setIsLoadingMedia] = useState(false);

  useEffect(() => {
    const loadMedia = async () => {
      if (displayStory.media_file_id && !mediaUrl) {
        setIsLoadingMedia(true);
        try {
          const url = await getFileFromChunks(displayStory.media_file_id);
          if (url) {
            setMediaUrl(url);
          }
        } catch (e) {
          console.error("Error loading story media:", e);
        } finally {
          setIsLoadingMedia(false);
        }
      } else {
        setMediaUrl(displayStory.media_url || null);
      }
    };
    loadMedia();
  }, [displayStory.id, displayStory.media_file_id, displayStory.media_url]);

  const handleDeleteStory = async () => {
    if (!currentUser || !currentUser.id) {
      toast.error('User tidak ditemukan');
      return;
    }
    
    setIsDeleting(true);
    try {
      await deleteStory(displayStory.id);
      toast.success('Cerita berhasil dihapus');
      // We don't need to manually navigate here.
      // The onSnapshot listener will update storyGroups, 
      // and our useEffect will automatically handle the navigation or closing.
    } catch (e) {
      console.error('Error deleting story:', e);
      toast.error('Terjadi kesalahan saat menghapus cerita');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleNext = () => {
    if (storyIndex < displayGroup.stories.length - 1) {
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
    let animationFrame: number;
    let lastTime = performance.now();
    let accumulatedTime = 0;
    const IMAGE_DURATION = 5000;

    const animate = (now: number) => {
      const deltaTime = now - lastTime;
      lastTime = now;

      if (!isPaused) {
        if (displayStory.media_type === 'video' && videoRef.current) {
          const { currentTime, duration } = videoRef.current;
          if (duration) {
            setProgress((currentTime / duration) * 100);
          }
        } else if (displayStory.media_type === 'image') {
          accumulatedTime += deltaTime;
          const p = Math.min((accumulatedTime / IMAGE_DURATION) * 100, 100);
          setProgress(p);
          if (p >= 100) {
            handleNext();
            return;
          }
        }
      }

      animationFrame = requestAnimationFrame(animate);
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [displayStory, isPaused]);

  const handleVideoTimeUpdate = () => {
    // We now use requestAnimationFrame for smoother updates
  };

  useEffect(() => {
    if (videoRef.current) {
      if (isPaused) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(() => {});
      }
    }
  }, [isPaused, displayStory]);

  useEffect(() => {
    // Record view
    viewStory(displayStory.id, currentUser.id).catch(console.error);
  }, [displayStory.id, currentUser.id]);

  useEffect(() => {
    // Dispatch event to toggle bottom navigation
    const event = new CustomEvent('toggle-nav', { 
      detail: { hidden: true } 
    });
    window.dispatchEvent(event);
    
    return () => {
      // Ensure nav is shown when component unmounts or modal closes
      const event = new CustomEvent('toggle-nav', { 
        detail: { hidden: false } 
      });
      window.dispatchEvent(event);
    };
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center"
    >
      
      <div 
        className="w-full max-w-md h-full sm:h-[90vh] sm:rounded-2xl overflow-hidden relative bg-slate-900 flex items-center justify-center"
        onMouseDown={() => setIsPaused(true)}
        onMouseUp={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
      >
        {/* Progress Bars */}
        <div className="absolute top-0 left-0 right-0 p-2 z-20 flex gap-1">
          {displayGroup.stories.map((_, idx) => (
            <div key={idx} className="h-1 flex-1 bg-white/30 rounded-full overflow-hidden">
              <div 
                className="h-full bg-white"
                style={{ width: `${idx < storyIndex ? 100 : idx === storyIndex ? progress : 0}%` }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-0 left-0 right-0 pt-6 px-4 pb-12 bg-gradient-to-b from-black/60 to-transparent z-30 flex items-start justify-between pointer-events-none">
          <div className="flex items-center gap-3 pointer-events-auto">
            <img src={displayGroup.user_avatar || 'https://picsum.photos/seed/avatar/48/48'} alt={displayGroup.user_name} className="w-10 h-10 rounded-full border border-white/20" />
            <div>
              <p className="text-white font-bold text-sm">{displayGroup.user_name}</p>
              <p className="text-white/70 text-xs">{formatDateWIB(displayStory.created_at)}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 pointer-events-auto">
             {(displayStory.user_id === currentUser.id || currentUser.role === 'admin') && (
                <button 
                  onClick={(e) => { e.stopPropagation(); handleDeleteStory(); }}
                  disabled={isDeleting}
                  className="p-2 text-white/80 hover:text-red-500 hover:bg-white/10 rounded-full transition-colors"
                  title="Hapus Cerita"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
             )}
             <button onClick={onClose} className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors">
                <X className="w-6 h-6" />
             </button>
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
            key={displayStory.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.2 }}
            className="w-full h-full flex items-center justify-center relative"
          >
            {isLoadingMedia ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-white text-sm font-medium">Memuat media...</p>
              </div>
            ) : (
              <TransformWrapper>
                <TransformComponent wrapperClass="w-full h-full" contentClass="w-full h-full">
                  {displayStory.media_type === 'video' ? (
                    <video 
                      ref={videoRef}
                      src={mediaUrl || undefined} 
                      autoPlay 
                      playsInline
                      muted={false}
                      onEnded={handleNext}
                      onTimeUpdate={handleVideoTimeUpdate}
                      className="w-full h-full object-contain" 
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-900">
                      <img 
                        src={mediaUrl || undefined} 
                        alt="Story" 
                        className="w-full h-full object-contain" 
                      />
                    </div>
                  )}
                </TransformComponent>
              </TransformWrapper>
            )}

            {/* Text Overlays */}
            {displayStory.text_overlays?.map((overlay, idx) => (
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
            {displayStory.tags && displayStory.tags.length > 0 && (
              <>
                {displayStory.tags.map((tag, idx) => (
                  <div 
                    key={`${tag.id}-${idx}`} 
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
        {displayStory.user_id === currentUser.id && (
          <div className="absolute bottom-4 left-0 right-0 flex justify-center z-30 pointer-events-none">
            <button 
              onClick={(e) => { e.stopPropagation(); setShowViewers(true); setIsPaused(true); }}
              className="flex items-center gap-2 bg-black/50 text-white px-4 py-2 rounded-full backdrop-blur-sm hover:bg-black/70 transition-colors pointer-events-auto"
            >
              <Eye className="w-4 h-4" />
              <span className="text-sm font-medium">{displayStory.views?.filter(v => v.id !== currentUser.id).length || 0} Tayangan</span>
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
                  Tayangan ({displayStory.views?.filter(v => v.id !== currentUser.id).length || 0})
                </h3>
                <button onClick={() => { setShowViewers(false); setIsPaused(false); }} className="text-slate-400 hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 pb-8 md:pb-4">
                {displayStory.views?.filter(v => v.id !== currentUser.id).length === 0 ? (
                  <p className="text-slate-400 text-center mt-4">Belum ada yang melihat cerita ini.</p>
                ) : (
                  <div className="flex flex-col gap-4">
                    {displayStory.views?.filter(v => v.id !== currentUser.id).map(viewer => (
                      <div key={viewer.id} className="flex items-center gap-3">
                        <img src={viewer.avatar || 'https://picsum.photos/seed/avatar/48/48'} alt={viewer.name} className="w-10 h-10 rounded-full" />
                        <div>
                          <p className="text-white font-medium">{viewer.name}</p>
                          <p className="text-slate-400 text-xs">{formatDateWIB(viewer.viewed_at)}</p>
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
  const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([]);
  const [activeStoryGroupIndex, setActiveStoryGroupIndex] = useState<number | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadMedia, setUploadMedia] = useState<{ url: string, type: 'image' | 'video', file?: File } | null>(null);
  
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  
  // Text Overlay State
  const [textOverlay, setTextOverlay] = useState<{ text: string, font: string, color: string, x: number, y: number } | null>(null);
  const [isEditingText, setIsEditingText] = useState(false);
  const [tempText, setTempText] = useState('');
  const [tempFont, setTempFont] = useState('font-sans');
  const [tempColor, setTempColor] = useState('#ffffff');
  
  // Tagging State
  const [taggedUsers, setTaggedUsers] = useState<{id: string, username: string, name: string, x: number, y: number}[]>([]);
  const [isTagging, setIsTagging] = useState(false);
  const [tagSearch, setTagSearch] = useState('');
  const [tagSuggestions, setTagSuggestions] = useState<User[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  
  const pressTimer = useRef<NodeJS.Timeout | null>(null);
  const isLongPress = useRef(false);

  useEffect(() => {
    const unsubscribe = listenToStories((data) => {
      // Ensure unique stories
      const uniqueStories = data.filter((story, index, self) => 
        index === self.findIndex((t) => (
          t.id === story.id
        ))
      );
      setStories(uniqueStories);
      
      // Group stories by user
      const groups: { [key: string]: StoryGroup } = {};
      uniqueStories.forEach(story => {
        if (!groups[story.user_id]) {
          groups[story.user_id] = {
            user_id: story.user_id,
            user_name: story.user_name,
            user_avatar: story.user_avatar,
            stories: []
          };
        }
        groups[story.user_id].stories.push(story);
      });
      
      const sortedGroups = Object.values(groups).sort((a, b) => {
        if (a.user_id === user.id) return -1;
        if (b.user_id === user.id) return 1;
        return 0;
      });
      setStoryGroups(sortedGroups);
    });

    return () => unsubscribe();
  }, []);

  const handleDeleteAllStories = async (userId: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Hapus Semua Cerita',
      message: 'Hapus semua cerita Anda?',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        try {
          const userStories = stories.filter(s => s.user_id === userId);
          for (const story of userStories) {
            await deleteStory(story.id);
          }
          toast.success('Semua cerita berhasil dihapus');
        } catch (error) {
          console.error('Error deleting stories:', error);
          toast.error('Gagal menghapus cerita');
        }
      }
    });
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Revoke previous URL if it was a blob URL
    if (uploadMedia?.url && uploadMedia.url.startsWith('blob:')) {
      URL.revokeObjectURL(uploadMedia.url);
    }

    // Reset input value to allow selecting same file again
    e.target.value = '';

    try {
      let result: string;
      let uploadFileObj: File | null = null;
      
      if (file.type.startsWith('image/') || file.type === 'image/heic' || file.name.toLowerCase().endsWith('.heic')) {
        // Compress image
        result = await compressImage(file);
        // Convert data URL back to File for chunked upload
        const response = await fetch(result);
        const blob = await response.blob();
        uploadFileObj = new File([blob], file.name.replace(/\.[^/.]+$/, ".jpg"), { type: 'image/jpeg' });
      } else if (file.type.startsWith('video/')) {
        // Use object URL for video preview (more efficient than data URL)
        result = URL.createObjectURL(file);
        uploadFileObj = file;
      } else {
        toast.error('Format file tidak didukung. Harap unggah gambar atau video.');
        return;
      }
      
      setUploadMedia({
        type: file.type.startsWith('video/') ? 'video' : 'image',
        url: result,
        file: uploadFileObj
      });
      setShowUpload(true);
      stopCamera();
    } catch (error) {
      console.error('Error reading file:', error);
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error('Gagal memproses file. Silakan coba lagi.');
      }
    }
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
    } catch (e: any) {
      console.error('Error accessing camera with facingMode:', e);
      // Fallback: try without facingMode
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ 
          video: true, 
          audio: true 
        });
        setCameraStream(fallbackStream);
        setFacingMode('user'); // Defaulting to user
        setShowCamera(true);
      } catch (fallbackError) {
        console.error('Error accessing camera fallback:', fallbackError);
        toast.error('Gagal mengakses kamera. Pastikan perangkat memiliki kamera dan Anda telah memberikan izin.');
      }
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

  const capturePhoto = async () => {
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
        
        // Convert base64 to File
        const response = await fetch(url);
        const blob = await response.blob();
        const file = new File([blob], `story_${Date.now()}.jpg`, { type: 'image/jpeg' });

        setUploadMedia({ url, type: 'image', file });
        stopCamera();
        setShowUpload(true);
      }
    }
  };

  const startRecording = () => {
    if (cameraStream) {
      const mimeTypes = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
        'video/mp4',
      ];
      const mimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type));
      
      const mediaRecorder = new MediaRecorder(cameraStream, mimeType ? { mimeType } : {});
      mediaRecorderRef.current = mediaRecorder;
      const chunks: BlobPart[] = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const mimeType = mediaRecorder.mimeType || 'video/mp4';
        const blob = new Blob(chunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const extension = mimeType.includes('mp4') ? 'mp4' : 'webm';
        const file = new File([blob], `story_${Date.now()}.${extension}`, { type: mimeType });
        setUploadMedia({ url, type: 'video', file });
        stopCamera();
        setShowUpload(true);
      };

      mediaRecorder.start();
      setIsRecording(true);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  useEffect(() => {
    return () => {
      if (uploadMedia?.url && uploadMedia.url.startsWith('blob:')) {
        URL.revokeObjectURL(uploadMedia.url);
      }
    };
  }, [uploadMedia]);
  const handlePressStart = () => {
    isLongPress.current = false;
    pressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      startRecording();
    }, 500); // 500ms threshold for long press
  };

  const handlePressEnd = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }

    if (isLongPress.current) {
      stopRecording();
    } else {
      capturePhoto();
    }
    isLongPress.current = false;
  };

  const searchUsers = async (query: string) => {
    if (!query) {
      setTagSuggestions([]);
      return;
    }
    try {
      const data = await search(query);
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
      let mediaUrl = uploadMedia.url;
      let mediaFileId = null;

      if (uploadMedia.file) {
        mediaFileId = await uploadFile(uploadMedia.file, (progress) => {
          setUploadProgress(progress);
        });
        mediaUrl = ''; // We'll use getFileFromChunks later
      }

      await createStory({
        user_id: user.id,
        media_url: mediaUrl,
        media_file_id: mediaFileId,
        media_type: uploadMedia.type,
        text_overlays: textOverlay ? [textOverlay] : [],
        tags: taggedUsers
      });
      
      setShowUpload(false);
      setUploadMedia(null);
      setUploadProgress(0);
      setTextOverlay(null);
      setTaggedUsers([]);
      setTempText('');
      setIsEditingText(false);
    } catch (e) {
      console.error(e);
      toast.error('Gagal mengunggah cerita. Silakan coba lagi.');
    } finally {
      setIsUploading(false);
    }
  };



  useEffect(() => {
    if (showCamera && !cameraStream) {
      startCamera();
    }
    
    // Dispatch event to toggle bottom navigation
    const event = new CustomEvent('toggle-nav', { 
      detail: { hidden: showCamera || showUpload } 
    });
    window.dispatchEvent(event);
    
    return () => {
      // Ensure nav is shown when component unmounts or modal closes
      const event = new CustomEvent('toggle-nav', { 
        detail: { hidden: false } 
      });
      window.dispatchEvent(event);
    };
  }, [showCamera, showUpload]);

  return (
    <div className="w-full py-2">
      <div className="flex gap-4 overflow-x-auto pb-2 px-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {/* Add Story Button */}
        <div className="flex flex-col items-center gap-1 shrink-0 cursor-pointer" onClick={() => setShowCamera(true)}>
          <div className="relative">
            <img src={user.avatar || 'https://picsum.photos/seed/avatar/48/48'} alt={user.name} className="w-16 h-16 rounded-full object-cover border-2 border-slate-200 p-0.5" />
            <div className="absolute bottom-0 right-0 bg-emerald-500 text-white rounded-full p-1 border-2 border-white">
              <Plus className="w-3 h-3" />
            </div>
          </div>
          <span className="text-xs font-medium text-slate-600">Buat Cerita</span>
        </div>

        {/* Story List */}
        {storyGroups.map((group, index) => {
          // Check if ALL stories in this group have been viewed by current user
          // We check the 'views' array in each story
          const allViewed = group.stories.every(story => {
            const views = story.views || [];
            return views.some(v => v.id === user.id);
          });
          
          return (
            <div key={group.user_id} className="flex flex-col items-center gap-1 shrink-0 cursor-pointer relative group" onClick={() => {
              setActiveStoryGroupIndex(index);
            }}>
              <div className={clsx(
                "w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300",
                !allViewed ? "p-[3px] bg-gradient-to-tr from-yellow-400 via-orange-500 to-fuchsia-600" : "p-[2px] bg-transparent"
              )}>
                <img 
                  src={group.user_avatar || 'https://picsum.photos/seed/avatar/48/48'} 
                  alt={group.user_name} 
                  className={clsx(
                    "w-full h-full rounded-full object-cover",
                    !allViewed ? "border-2 border-white" : "border border-slate-200"
                  )}
                />
              </div>
              <span className="text-xs font-medium text-slate-600 truncate w-16 text-center">{group.user_name.split(' ')[0]}</span>
              
              {(group.user_id === user.id || user.role === 'admin') && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteAllStories(group.user_id);
                  }}
                  className="absolute -top-1 -right-1 bg-red-500 text-white p-1 rounded-full shadow-lg z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Hapus semua cerita"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>
      <input type="file" accept="image/*,video/*,.heic" className="hidden" ref={fileInputRef} onChange={handleFileChange} />

      {/* Camera Modal */}
      <AnimatePresence>
        {showCamera && (
          <motion.div 
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
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
            </div>
            
            <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
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
                  onMouseDown={handlePressStart}
                  onMouseUp={handlePressEnd}
                  onTouchStart={handlePressStart}
                  onTouchEnd={handlePressEnd}
                  onContextMenu={(e) => e.preventDefault()}
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
              <button onClick={() => { setShowUpload(false); setUploadMedia(null); }} className="text-white p-2 bg-black/50 rounded-full hover:bg-black/80 transition-colors flex items-center gap-2 px-4">
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
              <div className="flex-1 min-h-0 bg-slate-900 relative flex items-center justify-center">
                <TransformWrapper>
                  <TransformComponent wrapperClass="w-full h-full" contentClass="w-full h-full">
                    {uploadMedia.type === 'video' ? (
                      <video src={uploadMedia.url || undefined} controls autoPlay className="w-full h-full object-contain" />
                    ) : (
                      <img src={uploadMedia.url || undefined} alt="Preview" className="w-full h-full object-contain" />
                    )}
                  </TransformComponent>
                </TransformWrapper>
                
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
                        key={`${tag.id}-${idx}`}
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
              <div className="p-4 pb-8 md:pb-4 flex justify-end shrink-0 bg-slate-900 border-t border-slate-800 z-[60]">
                <button 
                  onClick={handleUpload} 
                  disabled={isUploading}
                  className="px-6 py-2 bg-emerald-500 text-white font-bold rounded-full hover:bg-emerald-600 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  {isUploading ? `Mengunggah ${uploadProgress}%...` : 'Upload Story'}
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
                      <img src={u.avatar || 'https://picsum.photos/seed/avatar/48/48'} alt={u.name} className="w-10 h-10 rounded-full" />
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
            onClose={() => {
              setActiveStoryGroupIndex(null);
            }} 
            currentUser={user}
          />
        )}
      </AnimatePresence>
      {/* Confirmation Modal */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-slate-900 mb-2">{confirmDialog.title}</h3>
            <p className="text-slate-600 mb-6">{confirmDialog.message}</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium transition-colors"
              >
                Batal
              </button>
              <button
                onClick={confirmDialog.onConfirm}
                className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors"
              >
                Ya, Lanjutkan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
