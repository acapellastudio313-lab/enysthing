import React, { useState, useEffect, useRef, FormEvent, ChangeEvent } from 'react';
import { User, Message, Conversation } from '../types';
import { Send, Search, ArrowLeft, MoreVertical, MessageSquare, Plus, UserPlus, Paperclip, X, FileText, Image as ImageIcon, Video, Trash2, Check, CheckCheck, Loader2 } from 'lucide-react';
import { formatDateWIB, formatTimeWIB, formatDateOnlyWIB, compressImage } from '../utils';
import { useLocation, useSearchParams } from 'react-router-dom';
import { 
  getAllUsers, 
  listenToConversations, 
  listenToMessages, 
  sendMessage, 
  markAsRead, 
  deleteMessage, 
  deleteConversation,
  uploadFileChunks, 
  getFileFromChunks 
} from '../lib/db';
import { toast } from 'sonner';

export default function Messages({ user }: { user: User }) {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const conversationId = searchParams.get('conversationId');

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [showUserList, setShowUserList] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);

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

  const updateSelectedConversation = (conv: Conversation | null) => {
    setSelectedConversation(conv);
    if (conv) {
      setSearchParams({ conversationId: conv.id });
    } else {
      setSearchParams({});
    }
  };

  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [attachment, setAttachment] = useState<{ url: string | null, type: 'image' | 'video' | 'document', name?: string, file?: File } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [messageMedia, setMessageMedia] = useState<Record<string, string>>({});
  const [loadingMedia, setLoadingMedia] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const loadChunkedMedia = async () => {
      for (const msg of messages) {
        if (msg.attachment_file_id && !messageMedia[msg.id] && !loadingMedia[msg.id]) {
          setLoadingMedia(prev => ({ ...prev, [msg.id]: true }));
          const url = await getFileFromChunks(msg.attachment_file_id);
          if (url) {
            setMessageMedia(prev => ({ ...prev, [msg.id]: url }));
          }
          setLoadingMedia(prev => ({ ...prev, [msg.id]: false }));
        }
      }
    };
    loadChunkedMedia();
  }, [messages]);

  useEffect(() => {
    const init = async () => {
      const users = await getAllUsers();
      setAllUsers(users.filter(u => u.id !== user.id));
      
      const unsubscribeConvs = listenToConversations(user.id, (convs) => {
        setConversations(convs);
        setLoading(false);

        // Handle startWith from navigation state
        const state = location.state as { startWith?: User };
        if (state?.startWith) {
          const existing = convs.find(c => c.id === state.startWith?.id);
          if (existing) {
            updateSelectedConversation(existing);
          } else {
            // Create a temporary conversation object
            const tempConv: Conversation = {
              id: state.startWith.id,
              name: state.startWith.name,
              username: state.startWith.username,
              avatar: state.startWith.avatar,
              last_message: '',
              last_message_time: new Date().toISOString(),
              unread_count: 0
            };
            updateSelectedConversation(tempConv);
          }
        } else if (conversationId) {
          const existing = convs.find(c => c.id === conversationId);
          if (existing) {
            setSelectedConversation(existing);
          }
        }
      });

      return () => unsubscribeConvs();
    };
    
    init();
  }, [user.id, location.state]);

  useEffect(() => {
    if (selectedConversation) {
      const unsubscribeMessages = listenToMessages(user.id, selectedConversation.id, (msgs) => {
        setMessages(msgs);
        markAsRead(user.id, selectedConversation.id);
      });
      return () => unsubscribeMessages();
    }
  }, [selectedConversation, user.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    let type: 'image' | 'video' | 'document' = 'document';
    if (file.type.startsWith('image/')) type = 'image';
    else if (file.type.startsWith('video/')) type = 'video';

    if (type === 'image') {
       try {
         const url = await compressImage(file);
         setAttachment({ url, type, name: file.name, file });
       } catch (e) {
         console.error(e);
         toast.error('Gagal memproses gambar');
       }
    } else {
       const reader = new FileReader();
       reader.onloadend = () => {
         setAttachment({ url: reader.result as string, type, name: file.name, file });
       };
       reader.readAsDataURL(file);
    }
  };

  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && !attachment) || !selectedConversation) return;

    const content = newMessage.trim();
    const currentAttachment = attachment;
    
    setNewMessage('');
    setAttachment(null);
    setIsSending(true);

    try {
      let fileId = null;
      let url = currentAttachment?.url || null;

      if (currentAttachment?.file) {
        // Use chunked upload for all files in messages to be safe
        fileId = await uploadFileChunks(currentAttachment.file);
        url = null; 
      }

      await sendMessage(user.id, selectedConversation.id, content, currentAttachment ? {
        url,
        file_id: fileId,
        type: currentAttachment.type
      } : undefined);
    } catch (err) {
      console.error('Failed to send message', err);
    } finally {
      setIsSending(false);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!selectedConversation) return;
    setConfirmDialog({
      isOpen: true,
      title: 'Hapus Pesan',
      message: 'Hapus pesan ini?',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        try {
          await deleteMessage(user.id, selectedConversation.id, messageId);
        } catch (err) {
          console.error('Failed to delete message', err);
        }
      }
    });
  };

  const handleDeleteConversation = async (e: React.MouseEvent, otherUserId: string) => {
    e.stopPropagation();
    setConfirmDialog({
      isOpen: true,
      title: 'Hapus Percakapan',
      message: 'Hapus seluruh percakapan ini?',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        try {
          await deleteConversation(user.id, otherUserId);
          if (selectedConversation?.id === otherUserId) {
            setSelectedConversation(null);
          }
        } catch (err) {
          console.error('Failed to delete conversation', err);
        }
      }
    });
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const filteredConversations = conversations.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredUsers = allUsers.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleStartChat = (targetUser: User) => {
    const existing = conversations.find(c => c.id === targetUser.id);
    if (existing) {
      updateSelectedConversation(existing);
    } else {
      const tempConv: Conversation = {
        id: targetUser.id,
        name: targetUser.name,
        username: targetUser.username,
        avatar: targetUser.avatar,
        last_message: '',
        last_message_time: new Date().toISOString(),
        unread_count: 0
      };
      updateSelectedConversation(tempConv);
      setConversations(prev => [tempConv, ...prev]);
    }
    setShowUserList(false);
    setSearchTerm('');
  };

  return (
    <div className="flex h-[calc(100vh-64px)] bg-white overflow-hidden">
      {/* Conversations List */}
      <div className={`w-full md:w-80 lg:w-96 border-r border-slate-100 flex flex-col ${selectedConversation ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 border-b border-slate-100">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-xl font-bold text-slate-900">Pesan</h1>
            <button 
              onClick={() => setShowUserList(!showUserList)}
              className={`p-2 rounded-full transition-colors ${showUserList ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              title={showUserList ? "Lihat Percakapan" : "Pesan Baru"}
            >
              {showUserList ? <ArrowLeft className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder={showUserList ? "Cari pengguna..." : "Cari percakapan..."}
              className="w-full pl-10 pr-4 py-2 bg-slate-100 border-none rounded-full text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-slate-500 text-sm">Memuat...</div>
          ) : showUserList ? (
            filteredUsers.length > 0 ? (
              <div className="divide-y divide-slate-50">
                <div className="px-4 py-2 bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Daftar Pengguna
                </div>
                {filteredUsers.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => handleStartChat(u)}
                    className="w-full p-4 flex items-center gap-3 hover:bg-slate-50 transition-colors"
                  >
                    <img src={u.avatar || 'https://picsum.photos/seed/avatar/48/48'} alt={u.name} className="w-10 h-10 rounded-full object-cover" />
                    <div className="text-left">
                      <h3 className="font-bold text-slate-900 text-sm">{u.name}</h3>
                      <p className="text-xs text-slate-500">@{u.username}</p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500 text-sm">Pengguna tidak ditemukan.</div>
            )
          ) : filteredConversations.length > 0 ? (
            filteredConversations.map((conv) => (
              <div key={conv.id} className="relative group">
                <button
                  onClick={() => updateSelectedConversation(conv)}
                  className={`w-full p-4 flex items-center gap-3 hover:bg-slate-50 transition-colors border-b border-slate-50 ${selectedConversation?.id === conv.id ? 'bg-emerald-50/50' : ''}`}
                >
                  <div className="relative shrink-0">
                    <img src={conv.avatar || 'https://picsum.photos/seed/avatar/48/48'} alt={conv.name} className="w-12 h-12 rounded-full object-cover" />
                    {conv.unread_count > 0 && (
                      <span className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
                        {conv.unread_count}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 text-left min-w-0 pr-8">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <h3 className="font-bold text-slate-900 truncate text-sm">{conv.name}</h3>
                      <span className="text-[10px] text-slate-400 whitespace-nowrap">
                        {formatDateWIB(conv.last_message_time)}
                      </span>
                    </div>
                    <p className={`text-xs truncate ${conv.unread_count > 0 ? 'text-slate-900 font-bold' : 'text-slate-500'}`}>
                      {conv.last_message}
                    </p>
                  </div>
                </button>
                <button
                  onClick={(e) => handleDeleteConversation(e, conv.id)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full opacity-0 group-hover:opacity-100 transition-all"
                  title="Hapus Percakapan"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          ) : (
            <div className="p-8 text-center">
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <MessageSquare className="w-6 h-6 text-slate-400" />
              </div>
              <p className="text-sm text-slate-500">Belum ada percakapan.</p>
            </div>
          )}
        </div>
      </div>

      {/* Chat Interface */}
      <div className={`flex-1 flex flex-col bg-slate-50 ${!selectedConversation ? 'hidden md:flex items-center justify-center' : 'flex'}`}>
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="h-16 bg-white border-b border-slate-100 flex items-center justify-between px-4 shrink-0">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => updateSelectedConversation(null)}
                  className="md:hidden p-2 -ml-2 text-slate-500 hover:text-slate-900"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <img src={selectedConversation.avatar || 'https://picsum.photos/seed/avatar/48/48'} alt={selectedConversation.name} className="w-10 h-10 rounded-full object-cover" />
                <div>
                  <h2 className="font-bold text-slate-900 text-sm">{selectedConversation.name}</h2>
                  <p className="text-[10px] text-emerald-600 font-medium">Online</p>
                </div>
              </div>
              <button className="p-2 text-slate-400 hover:text-slate-900">
                <MoreVertical className="w-5 h-5" />
              </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg, idx) => {
                const isMe = msg.sender_id === user.id;
                const showDate = idx === 0 || formatDateOnlyWIB(messages[idx-1].created_at) !== formatDateOnlyWIB(msg.created_at);

                return (
                  <div key={msg.id} className="space-y-2">
                    {showDate && (
                      <div className="flex justify-center my-4">
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-200/50 px-2 py-1 rounded-full uppercase tracking-wider">
                          {formatDateOnlyWIB(msg.created_at)}
                        </span>
                      </div>
                    )}
                    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} group`}>
                      {isMe && (
                        <button
                          onClick={() => handleDeleteMessage(msg.id)}
                          className="opacity-0 group-hover:opacity-100 p-2 text-red-500 hover:bg-red-50 rounded-full transition-all mr-2 self-center"
                          title="Hapus Pesan"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      <div className={`max-w-[80%] sm:max-w-[70%] px-4 py-2 rounded-2xl text-sm shadow-sm ${
                        isMe 
                          ? 'bg-emerald-600 text-white rounded-tr-none' 
                          : 'bg-white text-slate-800 rounded-tl-none'
                      }`}>
                        {(msg.attachment_url || msg.attachment_file_id) && (
                          <div className="mb-2">
                            {msg.attachment_type === 'image' && (
                              <img src={msg.attachment_url || messageMedia[msg.id] || undefined} alt="Attachment" className="max-w-full rounded-lg" />
                            )}
                            {msg.attachment_type === 'video' && (
                              <div className="relative min-h-[100px] flex items-center justify-center">
                                {loadingMedia[msg.id] ? (
                                  <Loader2 className="w-6 h-6 animate-spin" />
                                ) : (
                                  <video src={msg.attachment_url || messageMedia[msg.id] || undefined} controls preload="auto" className="max-w-full rounded-lg" />
                                )}
                              </div>
                            )}
                            {msg.attachment_type === 'document' && (
                              <div className="relative">
                                {loadingMedia[msg.id] ? (
                                  <div className="flex items-center gap-2 p-2 bg-black/10 rounded-lg">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span className="text-xs">Memuat dokumen...</span>
                                  </div>
                                ) : (
                                  <a href={msg.attachment_url || messageMedia[msg.id]} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 bg-black/10 p-2 rounded-lg hover:bg-black/20 transition-colors">
                                    <FileText className="w-5 h-5" />
                                    <span className="underline">Lihat Dokumen</span>
                                  </a>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                        <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                        <p className={`text-[9px] mt-1 flex items-center justify-end gap-1 ${isMe ? 'text-emerald-100' : 'text-slate-400'}`}>
                          {formatTimeWIB(msg.created_at)}
                          {isMe && (
                            <span className="ml-0.5" title={msg.is_read ? "Dibaca" : "Terkirim"}>
                              {msg.is_read ? (
                                <CheckCheck className="w-3 h-3 text-blue-400" />
                              ) : (
                                <CheckCheck className="w-3 h-3 text-white opacity-90" />
                              )}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="p-4 bg-white border-t border-slate-100 shrink-0">
              {attachment && (
                <div className="mb-2 flex items-center gap-2 bg-slate-100 p-2 rounded-lg w-fit">
                  {attachment.type === 'image' && <ImageIcon className="w-4 h-4 text-slate-500" />}
                  {attachment.type === 'video' && <Video className="w-4 h-4 text-slate-500" />}
                  {attachment.type === 'document' && <FileText className="w-4 h-4 text-slate-500" />}
                  <span className="text-xs text-slate-600 truncate max-w-[200px]">{attachment.name || 'Lampiran'}</span>
                  <button onClick={() => setAttachment(null)} className="p-1 hover:bg-slate-200 rounded-full">
                    <X className="w-3 h-3 text-slate-500" />
                  </button>
                </div>
              )}
              <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button 
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-full transition-colors"
                >
                  <Paperclip className="w-5 h-5" />
                </button>
                <input
                  type="text"
                  placeholder="Ketik pesan..."
                  className="flex-1 bg-slate-100 border-none rounded-full px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                />
                <button
                  type="submit"
                  disabled={(!newMessage.trim() && !attachment) || isSending}
                  className="p-2 bg-emerald-600 text-white rounded-full hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:hover:bg-emerald-600"
                >
                  {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="text-center p-8">
            <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="w-10 h-10 text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Pilih percakapan</h2>
            <p className="text-slate-500 max-w-xs mx-auto">
              Pilih salah satu teman dari daftar di samping untuk mulai berkirim pesan.
            </p>
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
