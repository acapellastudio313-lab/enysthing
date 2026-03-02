import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User, Post } from '../types';
import PostItem from '../components/PostItem';
import { ArrowLeft } from 'lucide-react';

export default function PostDetail({ user }: { user: User }) {
  const { postId } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPost = () => {
    fetch(`/api/posts/${postId}?userId=${user.id}`)
      .then(res => {
        if (!res.ok) throw new Error('Post not found');
        return res.json();
      })
      .then(data => {
        setPost(data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchPost();
  }, [postId, user.id]);

  const handleLike = async (id: number) => {
    await fetch(`/api/posts/${id}/like`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id }),
    });
    fetchPost();
  };

  const handlePin = async (postId: number, isPinned: boolean) => {
    await fetch(`/api/admin/posts/${postId}/pin`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_pinned: !isPinned }),
    });
    fetchPost();
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Memuat postingan...</div>;
  if (!post) return <div className="p-8 text-center text-slate-500">Postingan tidak ditemukan.</div>;

  return (
    <div className="w-full min-h-screen bg-white">
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 py-3 flex items-center gap-3">
        <button 
          onClick={() => navigate(-1)}
          className="p-2 text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="font-bold text-lg text-slate-900">Postingan</h2>
      </div>
      
      <div className="border-b border-slate-100">
        <PostItem 
          post={post} 
          user={user} 
          onLike={handleLike} 
          onPin={handlePin}
          onCommentAdded={fetchPost}
          onPostUpdated={(updatedPost) => setPost(updatedPost)}
          onPostDeleted={() => navigate('/')}
          defaultShowComments={true}
        />
      </div>
    </div>
  );
}
