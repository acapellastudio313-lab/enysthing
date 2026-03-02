import { useState, useEffect, FormEvent } from 'react';
import { User, Post, Comment } from '../types';
import { Heart, MessageCircle, Share2, Send, CheckCircle, X, Pin, Edit, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';
import { clsx } from 'clsx';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import EditPostModal from './EditPostModal';
import { toast } from 'sonner';

interface PostItemProps {
  key?: number | string;
  post: Post;
  user: User;
  onLike: (postId: number) => void;
  onPin?: (postId: number, isPinned: boolean) => void;
  onCommentAdded: () => void;
  onPostUpdated: (updatedPost: Post) => void;
  onPostDeleted: (postId: number) => void;
  defaultShowComments?: boolean;
}

export default function PostItem({ post, user, onLike, onPin, onCommentAdded, onPostUpdated, onPostDeleted, defaultShowComments = false }: PostItemProps) {
  const [showComments, setShowComments] = useState(defaultShowComments);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState<number | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTick(t => t + 1);
    }, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  const fetchComments = async () => {
    setLoadingComments(true);
    try {
      const res = await fetch(`/api/posts/${post.id}/comments`);
      const data = await res.json();
      setComments(data);
    } finally {
      setLoadingComments(false);
    }
  };

  useEffect(() => {
    if (showComments) {
      fetchComments();
    }
  }, [showComments, post.id]);

  const handleCommentSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    await fetch(`/api/posts/${post.id}/comment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ author_id: user.id, content: newComment }),
    });

    setNewComment('');
    fetchComments();
    onCommentAdded();
  };

  const handleDelete = async () => {
    try {
      const res = await fetch(`/api/posts/${post.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      if (!res.ok) throw new Error('Gagal menghapus postingan');
      toast.success('Postingan berhasil dihapus');
      onPostDeleted(post.id);
    } catch (error: any) {
      toast.error(error.message);
    }
    setIsConfirmingDelete(false);
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!window.confirm('Anda yakin ingin menghapus komentar ini?')) return;
    try {
      const res = await fetch(`/api/comments/${commentId}?userId=${user.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Gagal menghapus komentar');
      }
      toast.success('Komentar berhasil dihapus');
      setComments(comments.filter(c => c.id !== commentId));
      onCommentAdded(); // To update counts
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <motion.article 
      whileHover={{ backgroundColor: "rgba(248, 250, 252, 0.8)" }}
      transition={{ duration: 0.2 }}
      className="p-3 md:p-4 transition-colors border-b border-slate-100"
    >
      <div className="flex gap-3 md:gap-4">
        <Link to={`/profile/${post.author_id}`} className="shrink-0">
          <img src={post.avatar || 'https://picsum.photos/seed/avatar/48/48'} alt={post.name || 'Unknown User'} className="w-10 h-10 md:w-12 md:h-12 rounded-full hover:opacity-80 transition-opacity" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 md:gap-2 flex-wrap min-w-0">
              <Link to={`/profile/${post.author_id}`} className="font-bold text-slate-900 truncate hover:underline text-sm md:text-base flex items-center gap-1">
                {post.name || 'Unknown User'}
                {post.is_verified === 1 && <CheckCircle className="w-3 h-3 text-blue-500 fill-blue-500 text-white" />}
              </Link>
              <Link to={`/profile/${post.author_id}`} className="text-slate-500 text-xs md:text-sm truncate hover:underline">
                @{post.username || 'unknown'}
              </Link>
              <span className="text-slate-400 text-xs md:text-sm">·</span>
              <span className="text-slate-500 text-xs md:text-sm hover:underline whitespace-nowrap">
                {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: id })}
              </span>
              {post.updated_at && post.updated_at !== post.created_at && (
                <span className="text-slate-400 text-xs md:text-sm">(diedit)</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {post.is_pinned === 1 && (
                <div className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">
                  <Pin className="w-2.5 h-2.5 fill-current" />
                  Disematkan
                </div>
              )}
              {user.id === post.author_id || user.role === 'admin' ? (
                <div className="flex items-center gap-1">
                  <button onClick={() => setIsEditing(true)} className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-full"><Edit className="w-3.5 h-3.5" /></button>
                  <button onClick={() => setIsConfirmingDelete(true)} className="p-1 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-full"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ) : null}
            </div>
          </div>
          <p className="mt-1 text-sm md:text-base text-slate-800 whitespace-pre-wrap break-words">{post.content}</p>
          
          {post.image_url && (
            <div 
              className="mt-3 rounded-2xl overflow-hidden border border-slate-200 cursor-pointer"
              onClick={() => setIsImageModalOpen(true)}
            >
              <img src={post.image_url} alt="Post attachment" className="w-full h-auto object-cover hover:opacity-95 transition-opacity" />
            </div>
          )}

          {post.audio_url && (
            <div className="mt-3 rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 p-2">
              <audio src={post.audio_url} controls className="w-full h-10" />
            </div>
          )}

          <div className="flex items-center justify-between mt-3 md:mt-4 max-w-md">
            <button 
              onClick={() => setShowComments(!showComments)}
              className={clsx(
                "flex items-center gap-1.5 md:gap-2 group transition-colors",
                showComments ? "text-emerald-600" : "text-slate-500 hover:text-emerald-600"
              )}
            >
              <div className={clsx(
                "p-1.5 md:p-2 rounded-full transition-colors",
                showComments ? "bg-emerald-50" : "group-hover:bg-emerald-50"
              )}>
                <MessageCircle className={clsx("w-4 h-4 md:w-5 md:h-5", showComments && "fill-emerald-100")} />
              </div>
              <span className="text-xs md:text-sm">{post.comments_count > 0 ? post.comments_count : ''}</span>
            </button>
            
            <button 
              onClick={() => onLike(post.id)}
              className={clsx(
                "flex items-center gap-1.5 md:gap-2 group transition-colors",
                post.is_liked === 1 ? "text-pink-600" : "text-slate-500 hover:text-pink-600"
              )}
            >
              <div className={clsx(
                "p-1.5 md:p-2 rounded-full transition-colors",
                post.is_liked === 1 ? "bg-pink-50" : "group-hover:bg-pink-50"
              )}>
                <Heart className={clsx("w-4 h-4 md:w-5 md:h-5", post.is_liked === 1 && "fill-current")} />
              </div>
              <span className="text-xs md:text-sm">{post.likes_count > 0 ? post.likes_count : ''}</span>
            </button>

            <button 
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/post/${post.id}`);
                alert('Tautan disalin ke papan klip!');
              }}
              className="flex items-center gap-1.5 md:gap-2 text-slate-500 hover:text-blue-600 group transition-colors"
            >
              <div className="p-1.5 md:p-2 rounded-full group-hover:bg-blue-50 transition-colors">
                <Share2 className="w-4 h-4 md:w-5 md:h-5" />
              </div>
            </button>

            {user.role === 'admin' && onPin && (
              <button 
                onClick={() => onPin(post.id, post.is_pinned === 1)}
                className={clsx(
                  "flex items-center gap-1.5 md:gap-2 group transition-colors",
                  post.is_pinned === 1 ? "text-emerald-600" : "text-slate-500 hover:text-emerald-600"
                )}
                title={post.is_pinned === 1 ? "Lepas Sematan" : "Sematkan Postingan"}
              >
                <div className={clsx(
                  "p-1.5 md:p-2 rounded-full transition-colors",
                  post.is_pinned === 1 ? "bg-emerald-50" : "group-hover:bg-emerald-50"
                )}>
                  <Pin className={clsx("w-4 h-4 md:w-5 md:h-5", post.is_pinned === 1 && "fill-current")} />
                </div>
              </button>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showComments && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 md:mt-4 pl-0 md:pl-12 pr-0 md:pr-4 space-y-4">
              {/* Comment Input */}
              <form onSubmit={handleCommentSubmit} className="flex gap-2 md:gap-3 items-start">
                <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full shrink-0 hidden md:block" />
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Tulis balasan..."
                    className="w-full bg-slate-100 border-transparent focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 rounded-full py-2 pl-4 pr-10 md:pr-12 text-sm transition-all outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!newComment.trim()}
                    className="absolute right-1 top-1 p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-full disabled:opacity-50 transition-colors"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </form>

              {/* Comments List */}
              {loadingComments ? (
                <div className="text-center text-sm text-slate-500 py-2">Memuat balasan...</div>
              ) : comments.length > 0 ? (
                <div className="space-y-4 pt-2">
                  {comments.map((comment) => (
                    <div key={comment.id} className="flex gap-3">
                      <Link to={`/profile/${comment.author_id}`}>
                        <img src={comment.avatar} alt={comment.name} className="w-8 h-8 rounded-full shrink-0 hover:opacity-80 transition-opacity" />
                      </Link>
                      <div className="flex-1 bg-slate-50 rounded-2xl px-4 py-2">
                        <div className="flex items-baseline gap-2">
                          <Link to={`/profile/${comment.author_id}`} className="font-bold text-sm text-slate-900 hover:underline">
                            {comment.name}
                          </Link>
                          <span className="text-xs text-slate-500">
                            {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: id })}
                          </span>
                        </div>
                        <p className="text-sm text-slate-800 mt-0.5">{comment.content}</p>
                      </div>
                      {(user.id === comment.author_id || user.role === 'admin') && (
                        <button onClick={() => handleDeleteComment(comment.id)} className="p-1 text-slate-400 hover:text-red-500 rounded-full ml-2 shrink-0">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-sm text-slate-500 py-4">Belum ada balasan. Jadilah yang pertama!</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Image Modal */}
      <AnimatePresence>
        {isImageModalOpen && post.image_url && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => setIsImageModalOpen(false)}
          >
            <button
              className="absolute top-4 right-4 p-2 text-white/70 hover:text-white bg-black/50 hover:bg-black/70 rounded-full transition-colors z-[60]"
              onClick={(e) => {
                e.stopPropagation();
                setIsImageModalOpen(false);
              }}
            >
              <X className="w-6 h-6" />
            </button>
            <div className="w-full h-full flex items-center justify-center cursor-move" onClick={(e) => e.stopPropagation()}>
              <TransformWrapper
                initialScale={1}
                minScale={0.5}
                maxScale={4}
                centerOnInit
              >
                <TransformComponent wrapperClass="!w-full !h-full" contentClass="!w-full !h-full flex items-center justify-center">
                  <motion.img
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    src={post.image_url}
                    alt="Post attachment full size"
                    className="max-w-full max-h-full object-contain rounded-lg shadow-2xl pointer-events-auto"
                  />
                </TransformComponent>
              </TransformWrapper>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isEditing && (
        <EditPostModal 
          post={post} 
          user={user} 
          onClose={() => setIsEditing(false)} 
          onPostUpdated={(updatedPost) => {
            onPostUpdated(updatedPost);
            setIsEditing(false);
          }}
        />
      )}

      {isConfirmingDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-neutral-800 rounded-2xl p-6 w-full max-w-sm">
            <h2 className="text-lg font-bold mb-2">Hapus Postingan?</h2>
            <p className="text-sm text-slate-600 dark:text-neutral-300 mb-6">Tindakan ini tidak dapat diurungkan. Anda yakin ingin menghapus postingan ini?</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setIsConfirmingDelete(false)} className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-neutral-700 font-semibold">Batal</button>
              <button onClick={handleDelete} className="px-4 py-2 rounded-lg bg-red-500 text-white font-semibold">Hapus</button>
            </div>
          </div>
        </div>
      )}

    </motion.article>
  );
}
