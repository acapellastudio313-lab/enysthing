import { Post } from '../types';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { MessageSquare, ThumbsUp, Trash2, Clock, User, FileText } from 'lucide-react';
import { clsx } from 'clsx';

interface PostsContentProps {
  posts: Post[];
  fetchAllPosts: () => Promise<void>;
}

export default function PostsContent({ posts, fetchAllPosts }: PostsContentProps) {
  const handleDeletePost = async (postId: number) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus postingan ini?')) {
      return;
    }
    try {
      const res = await fetch(`/api/posts/${postId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchAllPosts();
      } else {
        alert('Gagal menghapus postingan');
      }
    } catch (err) {
      alert('Terjadi kesalahan');
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-100">
        <h2 className="text-lg font-bold text-slate-900">Kelola Postingan</h2>
        <p className="text-sm text-slate-500">Total {posts.length} postingan publik</p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Konten</th>
              <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Penulis</th>
              <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider hidden md:table-cell">Tanggal</th>
              <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Statistik</th>
              <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Aksi</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-100">
            {posts.map(post => (
              <tr key={post.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="text-sm text-slate-900 line-clamp-2 max-w-xs">{post.content}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap hidden sm:table-cell">
                  <div className="flex items-center gap-2">
                    <img src={post.avatar} className="w-6 h-6 rounded-full" alt="" />
                    <span className="text-sm text-slate-600 font-medium">@{post.username}</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 hidden md:table-cell">
                  {format(new Date(post.created_at), 'dd MMM yyyy', { locale: id })}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-3 text-slate-500">
                    <div className="flex items-center gap-1 text-xs">
                      <ThumbsUp className="w-3.5 h-3.5" /> {post.likes_count}
                    </div>
                    <div className="flex items-center gap-1 text-xs">
                      <MessageSquare className="w-3.5 h-3.5" /> {post.comments_count}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => handleDeletePost(post.id)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                    title="Hapus Postingan"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {posts.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center">
                  <div className="flex flex-col items-center">
                    <FileText className="w-12 h-12 text-slate-200 mb-4" />
                    <p className="text-slate-500 font-medium">Tidak ada postingan ditemukan</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
