import { useState, useMemo } from 'react';
import { User } from '../types';
import { Home, Search, Gamepad2, LayoutGrid, MessageSquare, User as UserIcon, Shield, FileText, Mail, BookOpen, Users, Eye, EyeOff, CheckSquare, Square } from 'lucide-react';
import { clsx } from 'clsx';
import { doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { toast } from 'sonner';

interface MenuManagerProps {
  users: User[];
  onUsersUpdated: () => void;
}

export const AVAILABLE_MENUS = [
  { id: 'home', label: 'Beranda', icon: Home, category: 'Aplikasi Utama' },
  { id: 'explore', label: 'Eksplor', icon: Search, category: 'Aplikasi Utama' },
  { id: 'entertainment', label: 'Hiburan', icon: Gamepad2, category: 'Aplikasi Utama' },
  { id: 'apps', label: 'Aplikasi', icon: LayoutGrid, category: 'Aplikasi Utama' },
  { id: 'messages', label: 'Pesan', icon: MessageSquare, category: 'Aplikasi Utama' },
  { id: 'profile', label: 'Profil', icon: UserIcon, category: 'Aplikasi Utama' },
  
  { id: 'persuratan', label: 'Modul Persuratan', icon: FileText, category: 'Modul Ekstra' },
  { id: 'election', label: 'Modul Pemilihan', icon: Shield, category: 'Modul Ekstra' },
  
  { id: 'persuratan_dashboard', label: 'Persuratan - Dashboard', icon: LayoutGrid, category: 'Persuratan' },
  { id: 'persuratan_surat_masuk', label: 'Persuratan - Surat Masuk', icon: Mail, category: 'Persuratan' },
  { id: 'persuratan_surat_keluar', label: 'Persuratan - Surat Keluar', icon: Mail, category: 'Persuratan' },
  { id: 'persuratan_buku_nomor', label: 'Persuratan - Buku Nomor', icon: BookOpen, category: 'Persuratan' },
  { id: 'persuratan_manajemen_user', label: 'Persuratan - Manajemen User', icon: Users, category: 'Persuratan' },
];

export default function MenuManager({ users, onUsersUpdated }: MenuManagerProps) {
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
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

  const filteredUsers = useMemo(() => {
    return users.filter(u => 
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      u.username.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [users, searchQuery]);

  const isSingleSelection = selectedUserIds.length === 1;
  const selectedUser = isSingleSelection ? users.find(u => u.id === selectedUserIds[0]) : null;

  const handleSelectAll = () => {
    if (selectedUserIds.length === filteredUsers.length && filteredUsers.length > 0) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(filteredUsers.map(u => u.id));
    }
  };

  const handleToggleUser = (id: string) => {
    setSelectedUserIds(prev => 
      prev.includes(id) ? prev.filter(uid => uid !== id) : [...prev, id]
    );
  };

  const handleToggleMenuForUser = async (userId: string, menuId: string, currentHidden: string[] = []) => {
    try {
      const isCurrentlyHidden = currentHidden.includes(menuId);
      const newHiddenMenus = isCurrentlyHidden
        ? currentHidden.filter(id => id !== menuId)
        : [...currentHidden, menuId];

      await updateDoc(doc(db, 'users', userId), {
        hidden_menus: newHiddenMenus
      });
      
      onUsersUpdated();
      toast.success(`Menu ${isCurrentlyHidden ? 'ditampilkan' : 'disembunyikan'}`);
    } catch (error) {
      console.error('Error toggling menu:', error);
      toast.error('Gagal mengubah status menu');
    }
  };

  const handleBulkToggle = async (menuId: string, hide: boolean) => {
    if (selectedUserIds.length === 0) return;
    
    const isAll = selectedUserIds.length === users.length;
    
    setConfirmDialog({
      isOpen: true,
      title: 'Konfirmasi Perubahan',
      message: `Apakah Anda yakin ingin ${hide ? 'menyembunyikan' : 'menampilkan'} menu ini untuk ${isAll ? 'SEMUA' : selectedUserIds.length} pengguna terpilih?`,
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        setIsUpdating(true);
        try {
          const batch = writeBatch(db);
          
          selectedUserIds.forEach(userId => {
            const user = users.find(u => u.id === userId);
            if (!user) return;
            
            const currentHidden = user.hidden_menus || [];
            const isCurrentlyHidden = currentHidden.includes(menuId);
            
            if (hide && !isCurrentlyHidden) {
              batch.update(doc(db, 'users', user.id), { hidden_menus: [...currentHidden, menuId] });
            } else if (!hide && isCurrentlyHidden) {
              batch.update(doc(db, 'users', user.id), { hidden_menus: currentHidden.filter(id => id !== menuId) });
            }
          });
          
          await batch.commit();
          onUsersUpdated();
          toast.success(`Menu berhasil ${hide ? 'disembunyikan' : 'ditampilkan'} untuk pengguna terpilih`);
        } catch (error) {
          console.error('Error bulk toggling menu:', error);
          toast.error('Gagal mengubah status menu');
        } finally {
          setIsUpdating(false);
        }
      }
    });
  };

  const handleBulkToggleAllMenus = async (hide: boolean) => {
    if (selectedUserIds.length === 0) return;
    
    const isAll = selectedUserIds.length === users.length;
    
    setConfirmDialog({
      isOpen: true,
      title: 'Konfirmasi Perubahan Massal',
      message: `Apakah Anda yakin ingin ${hide ? 'menyembunyikan' : 'menampilkan'} SEMUA menu untuk ${isAll ? 'SEMUA' : selectedUserIds.length} pengguna terpilih?`,
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        setIsUpdating(true);
        try {
          const batch = writeBatch(db);
          const allMenuIds = AVAILABLE_MENUS.map(m => m.id);
          
          selectedUserIds.forEach(userId => {
            const user = users.find(u => u.id === userId);
            if (!user) return;
            
            if (hide) {
              batch.update(doc(db, 'users', user.id), { hidden_menus: allMenuIds });
            } else {
              batch.update(doc(db, 'users', user.id), { hidden_menus: [] });
            }
          });
          
          await batch.commit();
          onUsersUpdated();
          toast.success(`Semua menu berhasil ${hide ? 'disembunyikan' : 'ditampilkan'} untuk pengguna terpilih`);
        } catch (error) {
          console.error('Error bulk toggling all menus:', error);
          toast.error('Gagal mengubah status menu');
        } finally {
          setIsUpdating(false);
        }
      }
    });
  };

  const categories = Array.from(new Set(AVAILABLE_MENUS.map(m => m.category)));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left Column: User Selection */}
      <div className="lg:col-span-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[600px]">
        <div className="p-4 border-b border-slate-100 bg-slate-50">
          <h3 className="font-bold text-slate-900 mb-2">Pilih Pengguna</h3>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari pengguna..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>
        <div className="p-2 border-b border-slate-100 flex items-center justify-between bg-white">
          <label className="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-slate-50 rounded-lg">
            <input
              type="checkbox"
              checked={selectedUserIds.length > 0 && selectedUserIds.length === filteredUsers.length}
              onChange={handleSelectAll}
              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span className="text-sm font-medium text-slate-700">Pilih Semua ({filteredUsers.length})</span>
          </label>
          <span className="text-xs text-slate-500">{selectedUserIds.length} terpilih</span>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredUsers.map(u => (
            <label key={u.id} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={selectedUserIds.includes(u.id)}
                onChange={() => handleToggleUser(u.id)}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <img src={u.avatar || 'https://picsum.photos/seed/avatar/32/32'} alt={u.name} className="w-6 h-6 rounded-full object-cover shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{u.name}</p>
                  <p className="text-[10px] text-slate-500 truncate">@{u.username}</p>
                </div>
              </div>
            </label>
          ))}
          {filteredUsers.length === 0 && (
            <div className="text-center py-8 text-slate-500 text-sm">
              Tidak ada pengguna ditemukan.
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Menu Management */}
      <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-6 overflow-y-auto h-[600px]">
        {selectedUserIds.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500">
            <LayoutGrid className="w-12 h-12 mb-4 text-slate-300" />
            <p>Pilih satu atau lebih pengguna untuk mengatur menu</p>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Pengaturan Menu</h2>
                <p className="text-sm text-slate-500">
                  {isSingleSelection 
                    ? `Mengatur menu untuk ${selectedUser?.name}`
                    : `Menerapkan ke ${selectedUserIds.length} pengguna terpilih`
                  }
                </p>
              </div>
              {!isSingleSelection && (
                <div className="flex gap-2 shrink-0">
                  <button 
                    onClick={() => handleBulkToggleAllMenus(false)} 
                    disabled={isUpdating}
                    className="text-xs px-3 py-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 font-medium transition-colors disabled:opacity-50 flex items-center gap-1"
                  >
                    <Eye className="w-3 h-3" /> Tampilkan Semua
                  </button>
                  <button 
                    onClick={() => handleBulkToggleAllMenus(true)} 
                    disabled={isUpdating}
                    className="text-xs px-3 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 font-medium transition-colors disabled:opacity-50 flex items-center gap-1"
                  >
                    <EyeOff className="w-3 h-3" /> Sembunyikan Semua
                  </button>
                </div>
              )}
            </div>

            {categories.map(category => (
              <div key={category}>
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">
                  {category}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {AVAILABLE_MENUS.filter(m => m.category === category).map(menu => {
                    let isHidden = false;
                    let isMixed = false;

                    if (isSingleSelection && selectedUser) {
                      isHidden = selectedUser.hidden_menus?.includes(menu.id) || false;
                    } else {
                      const hiddenCount = selectedUserIds.filter(id => {
                        const u = users.find(user => user.id === id);
                        return u?.hidden_menus?.includes(menu.id);
                      }).length;

                      if (hiddenCount === selectedUserIds.length) {
                        isHidden = true;
                      } else if (hiddenCount > 0) {
                        isMixed = true;
                      }
                    }

                    return (
                      <div 
                        key={menu.id} 
                        className={clsx(
                          "flex items-center justify-between p-4 rounded-2xl border transition-all",
                          isHidden ? "bg-slate-50 border-slate-200" : isMixed ? "bg-amber-50 border-amber-100" : "bg-white border-emerald-100 shadow-sm"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className={clsx(
                            "p-2 rounded-xl",
                            isHidden ? "bg-slate-200 text-slate-500" : isMixed ? "bg-amber-100 text-amber-600" : "bg-emerald-100 text-emerald-600"
                          )}>
                            <menu.icon className="w-5 h-5" />
                          </div>
                          <div>
                            <p className={clsx("text-sm font-bold", isHidden ? "text-slate-500" : isMixed ? "text-amber-700" : "text-slate-900")}>
                              {menu.label}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              {isHidden ? 'Disembunyikan' : isMixed ? 'Bervariasi' : 'Ditampilkan'}
                            </p>
                          </div>
                        </div>

                        {isSingleSelection ? (
                          <button
                            onClick={() => selectedUser && handleToggleMenuForUser(selectedUser.id, menu.id, selectedUser.hidden_menus)}
                            className={clsx(
                              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                              !isHidden ? "bg-emerald-500" : "bg-slate-300"
                            )}
                          >
                            <span
                              className={clsx(
                                "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                                !isHidden ? "translate-x-6" : "translate-x-1"
                              )}
                            />
                          </button>
                        ) : (
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleBulkToggle(menu.id, false)}
                              disabled={isUpdating}
                              className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                              title="Tampilkan untuk terpilih"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleBulkToggle(menu.id, true)}
                              disabled={isUpdating}
                              className="p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors disabled:opacity-50"
                              title="Sembunyikan untuk terpilih"
                            >
                              <EyeOff className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
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
