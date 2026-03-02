import { useState, useEffect, useRef, FormEvent } from 'react';
import { User, Message, Conversation } from '../types';
import { Send, Search, ArrowLeft, MoreVertical, MessageSquare, Plus, UserPlus } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { useLocation } from 'react-router-dom';

export default function Messages({ user }: { user: User }) {
  const location = useLocation();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [showUserList, setShowUserList] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const init = async () => {
      const currentConvs = await fetchConversations();
      await fetchAllUsers();
      
      // Handle startWith from navigation state
      const state = location.state as { startWith?: User };
      if (state?.startWith) {
        const existing = currentConvs.find((c: Conversation) => c.id === state.startWith?.id);
        if (existing) {
          setSelectedConversation(existing);
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
          setSelectedConversation(tempConv);
          setConversations(prev => {
            if (prev.find(p => p.id === tempConv.id)) return prev;
            return [tempConv, ...prev];
          });
        }
      }
    };
    
    init();
    const interval = setInterval(fetchConversations, 10000);
    return () => clearInterval(interval);
  }, [user.id, location.state]);

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation.id);
      const interval = setInterval(() => fetchMessages(selectedConversation.id), 3000);
      return () => clearInterval(interval);
    }
  }, [selectedConversation, user.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchConversations = async () => {
    try {
      const res = await fetch(`/api/messages/conversations/${user.id}`);
      const data = await res.json();
      setConversations(data);
      setLoading(false);
      return data;
    } catch (err: any) {
      if (err.message !== 'Failed to fetch') {
        console.error('Failed to fetch conversations', err);
      }
      return [];
    }
  };

  const fetchAllUsers = async () => {
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      // Filter out current user
      setAllUsers(data.filter((u: User) => u.id !== user.id));
    } catch (err: any) {
      if (err.message !== 'Failed to fetch') {
        console.error('Failed to fetch users', err);
      }
    }
  };

  const fetchMessages = async (otherUserId: number) => {
    try {
      const res = await fetch(`/api/messages/${user.id}/${otherUserId}`);
      const data = await res.json();
      setMessages(data);
    } catch (err: any) {
      if (err.message !== 'Failed to fetch') {
        console.error('Failed to fetch messages', err);
      }
    }
  };

  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConversation) return;

    const content = newMessage.trim();
    setNewMessage('');

    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender_id: user.id,
          receiver_id: selectedConversation.id,
          content
        }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, data]);
      fetchConversations();
    } catch (err) {
      console.error('Failed to send message', err);
    }
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
      setSelectedConversation(existing);
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
      setSelectedConversation(tempConv);
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
                    <img src={u.avatar} alt={u.name} className="w-10 h-10 rounded-full object-cover" />
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
              <button
                key={conv.id}
                onClick={() => setSelectedConversation(conv)}
                className={`w-full p-4 flex items-center gap-3 hover:bg-slate-50 transition-colors border-b border-slate-50 ${selectedConversation?.id === conv.id ? 'bg-emerald-50/50' : ''}`}
              >
                <div className="relative shrink-0">
                  <img src={conv.avatar} alt={conv.name} className="w-12 h-12 rounded-full object-cover" />
                  {conv.unread_count > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
                      {conv.unread_count}
                    </span>
                  )}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <div className="flex justify-between items-baseline mb-0.5">
                    <h3 className="font-bold text-slate-900 truncate text-sm">{conv.name}</h3>
                    <span className="text-[10px] text-slate-400 whitespace-nowrap">
                      {format(new Date(conv.last_message_time), 'HH:mm', { locale: id })}
                    </span>
                  </div>
                  <p className={`text-xs truncate ${conv.unread_count > 0 ? 'text-slate-900 font-bold' : 'text-slate-500'}`}>
                    {conv.last_message}
                  </p>
                </div>
              </button>
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
                  onClick={() => setSelectedConversation(null)}
                  className="md:hidden p-2 -ml-2 text-slate-500 hover:text-slate-900"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <img src={selectedConversation.avatar} alt={selectedConversation.name} className="w-10 h-10 rounded-full object-cover" />
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
                const showDate = idx === 0 || format(new Date(messages[idx-1].created_at), 'yyyy-MM-dd') !== format(new Date(msg.created_at), 'yyyy-MM-dd');

                return (
                  <div key={msg.id} className="space-y-2">
                    {showDate && (
                      <div className="flex justify-center my-4">
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-200/50 px-2 py-1 rounded-full uppercase tracking-wider">
                          {format(new Date(msg.created_at), 'd MMMM yyyy', { locale: id })}
                        </span>
                      </div>
                    )}
                    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] sm:max-w-[70%] px-4 py-2 rounded-2xl text-sm shadow-sm ${
                        isMe 
                          ? 'bg-emerald-600 text-white rounded-tr-none' 
                          : 'bg-white text-slate-800 rounded-tl-none'
                      }`}>
                        <p className="leading-relaxed">{msg.content}</p>
                        <p className={`text-[9px] mt-1 text-right ${isMe ? 'text-emerald-100' : 'text-slate-400'}`}>
                          {format(new Date(msg.created_at), 'HH:mm')}
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
              <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Ketik pesan..."
                  className="flex-1 bg-slate-100 border-none rounded-full px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim()}
                  className="p-2 bg-emerald-600 text-white rounded-full hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:hover:bg-emerald-600"
                >
                  <Send className="w-5 h-5" />
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
    </div>
  );
}
