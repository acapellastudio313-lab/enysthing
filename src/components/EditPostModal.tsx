import { useState } from 'react';
import { Post, User } from '../types';
import { toast } from 'sonner';
import { Trash2, Edit } from 'lucide-react';

interface EditPostModalProps {
  post: Post;
  user: User;
  onClose: () => void;
  onPostUpdated: (updatedPost: Post) => void;
}

export default function EditPostModal({ post, user, onClose, onPostUpdated }: EditPostModalProps) {
  const [content, setContent] = useState(post.content);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!content.trim()) {
      toast.error('Postingan tidak boleh kosong');
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch(`/api/posts/${post.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, userId: user.id }),
      });
      if (!res.ok) throw new Error('Gagal menyimpan perubahan');
      const updatedPost = await res.json();
      onPostUpdated(updatedPost);
      toast.success('Postingan berhasil diperbarui');
      onClose();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-800 rounded-2xl p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Edit Postingan</h2>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full h-40 p-2 border rounded-lg bg-gray-100 dark:bg-neutral-700 border-gray-300 dark:border-neutral-600 mb-4"
          placeholder="Apa yang Anda pikirkan?"
        />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-neutral-700">Batal</button>
          <button onClick={handleSave} disabled={isSaving} className="px-4 py-2 rounded-lg bg-blue-500 text-white disabled:opacity-50">
            {isSaving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  );
}
