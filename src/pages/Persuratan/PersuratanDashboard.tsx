import React, { useState, useEffect } from 'react';
import { User, Surat } from '../../types';
import { useNavigate } from 'react-router-dom';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  LineChart,
  Line
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  Mail, 
  Send, 
  Clock, 
  CheckCircle2,
  AlertCircle,
  ChevronRight
} from 'lucide-react';
import { collection, query, onSnapshot, where, limit, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { clsx } from 'clsx';

export default function PersuratanDashboard({ user, onNavigate }: { user: User, onNavigate: (tab: string, suratId?: string) => void }) {
  const [stats, setStats] = useState({
    totalMasuk: 0,
    totalKeluar: 0,
    pending: 0,
    approved: 0
  });

  const [recentSurat, setRecentSurat] = useState<Surat[]>([]);

  const [chartData, setChartData] = useState([
    { name: 'Jan', masuk: 0, keluar: 0 },
    { name: 'Feb', masuk: 0, keluar: 0 },
    { name: 'Mar', masuk: 0, keluar: 0 },
    { name: 'Apr', masuk: 0, keluar: 0 },
    { name: 'Mei', masuk: 0, keluar: 0 },
    { name: 'Jun', masuk: 0, keluar: 0 },
    { name: 'Jul', masuk: 0, keluar: 0 },
    { name: 'Agu', masuk: 0, keluar: 0 },
    { name: 'Sep', masuk: 0, keluar: 0 },
    { name: 'Okt', masuk: 0, keluar: 0 },
    { name: 'Nov', masuk: 0, keluar: 0 },
    { name: 'Des', masuk: 0, keluar: 0 },
  ]);

  useEffect(() => {
    const unsubMasuk = onSnapshot(query(collection(db, 'surat'), where('type', '==', 'masuk')), (snap) => {
      setStats(prev => ({ ...prev, totalMasuk: snap.size }));
    });
    const unsubKeluar = onSnapshot(query(collection(db, 'surat'), where('type', '==', 'keluar')), (snap) => {
      setStats(prev => ({ ...prev, totalKeluar: snap.size }));
    });
    const unsubPending = onSnapshot(query(collection(db, 'surat'), where('status', '==', 'pending')), (snap) => {
      setStats(prev => ({ ...prev, pending: snap.size }));
    });
    const unsubApproved = onSnapshot(query(collection(db, 'surat'), where('status', '==', 'approved')), (snap) => {
      setStats(prev => ({ ...prev, approved: snap.size }));
    });

    const qRecent = query(collection(db, 'surat'), orderBy('createdAt', 'desc'), limit(5));
    const unsubRecent = onSnapshot(qRecent, (snap) => {
      setRecentSurat(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Surat)));
    });

    // Dynamic Chart Data
    const unsubChart = onSnapshot(collection(db, 'surat'), (snap) => {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
      const currentYear = new Date().getFullYear();
      
      const counts = months.map(month => ({ name: month, masuk: 0, keluar: 0 }));
      
      snap.docs.forEach(doc => {
        const data = doc.data() as Surat;
        const date = data.createdAt?.toDate?.() || new Date(data.tanggal);
        if (date.getFullYear() === currentYear) {
          const monthIndex = date.getMonth();
          if (data.type === 'masuk') counts[monthIndex].masuk++;
          else if (data.type === 'keluar') counts[monthIndex].keluar++;
        }
      });
      
      setChartData(counts);
    });

    return () => {
      unsubMasuk();
      unsubKeluar();
      unsubPending();
      unsubApproved();
      unsubRecent();
      unsubChart();
    };
  }, []);

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'];

  const pieData = [
    { name: 'Disetujui', value: stats.approved },
    { name: 'Menunggu', value: stats.pending },
    { name: 'Ditolak', value: 0 },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Welcome Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard Persuratan</h1>
        <p className="text-slate-500 text-sm">Selamat datang kembali, {user.name}. Berikut ringkasan aktivitas hari ini.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Surat Masuk', value: stats.totalMasuk, icon: Mail, color: 'text-emerald-600', bg: 'bg-emerald-50', link: 'persuratan_surat_masuk' },
          { label: 'Surat Keluar', value: stats.totalKeluar, icon: Send, color: 'text-blue-600', bg: 'bg-blue-50', link: 'persuratan_surat_keluar' },
          { label: 'Menunggu Persetujuan', value: stats.pending, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', link: 'persuratan_surat_masuk' },
          { label: 'Buku Kendali', value: stats.totalMasuk + stats.totalKeluar, icon: CheckCircle2, color: 'text-purple-600', bg: 'bg-purple-50', link: 'persuratan_buku_nomor' },
        ].filter(stat => !user.hidden_menus?.includes(stat.link)).map((stat, i) => (
          <button 
            key={i} 
            onClick={() => onNavigate(stat.link)}
            className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all text-left group"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={clsx("p-3 rounded-xl transition-colors", stat.bg, "group-hover:bg-white group-hover:shadow-inner")}>
                <stat.icon className={clsx("w-6 h-6", stat.color)} />
              </div>
              <div className="flex items-center gap-1 text-emerald-600 text-xs font-bold">
                <TrendingUp className="w-3 h-3" />
                +12%
              </div>
            </div>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">{stat.label}</p>
            <h3 className="text-3xl font-bold text-slate-900 mt-1">{stat.value}</h3>
          </button>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Activity Chart */}
        <div 
          onClick={() => onNavigate('persuratan_buku_nomor')}
          className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm cursor-pointer hover:border-emerald-200 transition-all"
        >
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="font-bold text-slate-900">Aktivitas Persuratan</h3>
              <p className="text-xs text-slate-500">Statistik surat masuk & keluar per bulan</p>
            </div>
            <select 
              onClick={(e) => e.stopPropagation()}
              className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none"
            >
              <option>Tahun 2026</option>
              <option>Tahun 2025</option>
            </select>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  cursor={{ fill: '#f8fafc' }}
                />
                <Bar dataKey="masuk" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                <Bar dataKey="keluar" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Distribution */}
        <div 
          onClick={() => onNavigate('persuratan_surat_masuk')}
          className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm cursor-pointer hover:border-emerald-200 transition-all"
        >
          <h3 className="font-bold text-slate-900 mb-1">Status Persetujuan</h3>
          <p className="text-xs text-slate-500 mb-8">Distribusi status surat saat ini</p>
          <div className="h-[250px] w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-bold text-slate-900">{stats.totalMasuk + stats.totalKeluar}</span>
              <span className="text-[10px] text-slate-500 uppercase font-bold">Total Surat</span>
            </div>
          </div>
          <div className="mt-6 space-y-3">
            {pieData.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                  <span className="text-slate-600">{item.name}</span>
                </div>
                <span className="font-bold text-slate-900">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Activity Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900">Aktivitas Terbaru</h3>
          <button 
            onClick={() => onNavigate('persuratan_surat_masuk')}
            className="text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-colors"
          >
            Lihat Semua
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              <tr>
                <th className="px-6 py-4">Nomor Surat</th>
                <th className="px-6 py-4">Perihal</th>
                <th className="px-6 py-4">Tanggal</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentSurat.map((item) => (
                <tr 
                  key={item.id} 
                  onClick={() => onNavigate(item.type === 'masuk' ? 'persuratan_surat_masuk' : 'persuratan_surat_keluar')}
                  className="hover:bg-slate-50 transition-colors cursor-pointer group"
                >
                  <td className="px-6 py-4 text-sm font-mono font-bold text-slate-900">{item.nomor}</td>
                  <td className="px-6 py-4 text-sm text-slate-600 max-w-xs truncate">{item.perihal}</td>
                  <td className="px-6 py-4 text-sm text-slate-500">{item.tanggal}</td>
                  <td className="px-6 py-4">
                    <span className={clsx(
                      "px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-tight",
                      item.status === 'approved' ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                    )}>
                      {item.status === 'approved' ? 'Disetujui' : 'Menunggu'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-500 transition-colors" />
                  </td>
                </tr>
              ))}
              {recentSurat.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400 text-sm">
                    Belum ada aktivitas terbaru
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
