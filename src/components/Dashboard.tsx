import React, { useEffect, useState } from 'react';
import socket from '../lib/socket';
import { 
  TrendingUp, 
  Users, 
  ShoppingBag, 
  Wallet, 
  ArrowUpRight, 
  ArrowDownRight,
  MoreHorizontal,
  CheckCircle2,
  Clock,
  AlertCircle,
  BarChart3,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  LayoutGrid,
  FileText,
  Download,
  Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  BarChart, 
  Bar, 
  LineChart,
  Line,
  PieChart,
  Pie,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  AreaChart,
  Area
} from 'recharts';

type ChartType = 'bar' | 'line' | 'pie';

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalRevenue: 0,
    pendingOrders: 0,
    distributedCoins: 0
  });
  const [salesData, setSalesData] = useState([]);
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [isExporting, setIsExporting] = useState(false);

  const transactions = [
    { id: 'INV-001', user: 'Ahmad Fauzi', amount: 25000, status: 'lunas', date: '2026-04-27 16:45', method: 'Koin' },
    { id: 'INV-002', user: 'Siti Aminah', amount: 32000, status: 'menunggu', date: '2026-04-27 15:20', method: 'Saldo' },
    { id: 'INV-003', user: 'Budi Santoso', amount: 15000, status: 'lunas', date: '2026-04-27 14:10', method: 'Koin' },
    { id: 'INV-004', user: 'Dewi Lestari', amount: 50000, status: 'lunas', date: '2026-04-27 12:00', method: 'Top-up' },
    { id: 'INV-005', user: 'Eko Prasetyo', amount: 12000, status: 'lunas', date: '2026-04-26 18:30', method: 'Koin' },
  ];

  const exportToPDF = () => {
    setIsExporting(true);
    const doc = new jsPDF();

    // Header
    doc.setFontSize(20);
    doc.setTextColor(79, 70, 229); // Indigo-600
    doc.text('LAPORAN RIWAYAT TRANSAKSI', 14, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Dicetak pada: ${new Date().toLocaleString('id-ID')}`, 14, 30);
    doc.text('Sistem Manajemen Kantin Pintar - Dashboard Admin', 14, 35);

    // Summary Section
    doc.setDrawColor(241, 245, 249);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, 45, 182, 30, 3, 3, 'FD');
    
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.text('RINGKASAN FINANSIAL', 20, 55);
    
    doc.setFontSize(10);
    doc.text(`Total Pemasukan: Rp ${stats.totalRevenue.toLocaleString()}`, 20, 65);
    doc.text(`Koin Terdistribusi: ${stats.distributedCoins.toLocaleString()}`, 100, 65);

    // Table
    autoTable(doc, {
      startY: 85,
      head: [['ID Transaksi', 'Pelanggan', 'Waktu', 'Metode', 'Status', 'Nominal']],
      body: transactions.map(t => [
        t.id, 
        t.user, 
        t.date, 
        t.method, 
        t.status.toUpperCase(), 
        `Rp ${t.amount.toLocaleString()}`
      ]),
      headStyles: { fillColor: [79, 70, 229], fontSize: 10, halign: 'center' },
      bodyStyles: { fontSize: 9 },
      columnStyles: {
        5: { halign: 'right' }
      },
      margin: { top: 85 },
    });

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Halaman ${i} dari ${pageCount}`, 190, 285, { align: 'right' });
    }

    doc.save(`Laporan_Transaksi_${new Date().toISOString().split('T')[0]}.pdf`);
    
    setTimeout(() => {
      setIsExporting(false);
    }, 1000);
  };

  useEffect(() => {
    const fetchData = () => {
      fetch('/api/stats')
        .then(res => res.json())
        .then(data => setStats(data))
        .catch(err => console.error("Failed to fetch stats:", err));

      fetch('/api/sales-data')
        .then(res => res.json())
        .then(data => setSalesData(data))
        .catch(err => console.error("Failed to fetch sales data:", err));
    };

    fetchData();

    socket.on("stats_updated", fetchData);
    socket.on("order_updated", fetchData);
    socket.on("new_order", fetchData);

    return () => {
      socket.off("stats_updated", fetchData);
      socket.off("order_updated", fetchData);
      socket.off("new_order", fetchData);
    };
  }, []);

  const summaryCards = [
    { 
      label: 'Total Pemasukan', 
      value: `Rp ${stats.totalRevenue.toLocaleString()}`, 
      change: '+12.5%', 
      isPositive: true, 
      icon: TrendingUp,
      color: 'indigo'
    },
    { 
      label: 'Pesanan Tertunda', 
      value: stats.pendingOrders.toString(), 
      change: '-2.4%', 
      isPositive: true, 
      icon: ShoppingBag,
      color: 'amber'
    },
    { 
      label: 'Koin Terdistribusi', 
      value: stats.distributedCoins.toLocaleString(), 
      change: '+18.2%', 
      isPositive: true, 
      icon: Wallet,
      color: 'emerald'
    },
  ];

  const renderChart = () => {
    switch (chartType) {
      case 'line':
        return (
          <LineChart data={salesData} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
            <XAxis 
              dataKey="day" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#94A3B8', fontSize: 12, fontWeight: 500 }}
              dy={10}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#94A3B8', fontSize: 10, fontWeight: 500 }}
              tickFormatter={(value) => `Rp ${value / 1000000}jt`}
            />
            <Tooltip 
              contentStyle={{ 
                borderRadius: '12px', 
                border: '1px solid #F1F5F9', 
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                fontSize: '12px',
                fontWeight: 'bold'
              }}
              formatter={(value) => [`Rp ${value.toLocaleString()}`, 'Penjualan']}
            />
            <Line 
              type="monotone" 
              dataKey="sales" 
              stroke="#4F46E5" 
              strokeWidth={3} 
              dot={{ fill: '#4F46E5', strokeWidth: 2, r: 4, stroke: '#fff' }}
              activeDot={{ r: 6, strokeWidth: 0 }}
            />
          </LineChart>
        );
      case 'pie':
        return (
          <PieChart>
            <Pie
              data={salesData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={5}
              dataKey="sales"
              nameKey="day"
            >
              {salesData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={['#4F46E5', '#6366F1', '#818CF8', '#A5B4FC', '#C7D2FE', '#E0E7FF', '#EEF2FF'][index % 7]} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ 
                borderRadius: '12px', 
                border: '1px solid #F1F5F9', 
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                fontSize: '12px',
                fontWeight: 'bold'
              }}
              formatter={(value) => [`Rp ${value.toLocaleString()}`, 'Penjualan']}
            />
          </PieChart>
        );
      default:
        return (
          <BarChart data={salesData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
            <XAxis 
              dataKey="day" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#94A3B8', fontSize: 12, fontWeight: 500 }}
              dy={10}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#94A3B8', fontSize: 10, fontWeight: 500 }}
              tickFormatter={(value) => `Rp ${value / 1000000}jt`}
            />
            <Tooltip 
              cursor={{ fill: '#F8FAFC' }}
              contentStyle={{ 
                borderRadius: '12px', 
                border: '1px solid #F1F5F9', 
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                fontSize: '12px',
                fontWeight: 'bold'
              }}
              formatter={(value) => [`Rp ${value.toLocaleString()}`, 'Penjualan']}
            />
            <Bar dataKey="sales" radius={[6, 6, 0, 0]} barSize={40}>
              {salesData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={index === salesData.length - 1 ? '#4F46E5' : '#E2E8F0'} />
              ))}
            </Bar>
          </BarChart>
        );
    }
  };

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-bold text-slate-900">Ringkasan Dasbor</h2>
          <p className="text-sm text-slate-500 font-medium">Memantau transaksi dan aktivitas pengguna secara real-time.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => {
              fetch('/api/orders/simulate', { method: 'POST' });
              alert('Pesanan baru telah disimulasikan! Cek di Kasir atau Dapur.');
            }}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-100 transition-all shadow-sm"
          >
            <ShoppingBag size={14} />
            Simulasi Pesanan
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {summaryCards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-6 rounded-2xl border border-slate-100 shadow-premium group hover:border-indigo-100 transition-all"
          >
            <div className="flex items-start justify-between mb-4">
              <div className={`p-3 rounded-xl bg-${card.color}-50 text-${card.color}-600`}>
                <card.icon className="w-6 h-6" />
              </div>
              <div className={cn(
                "flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full",
                card.isPositive ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
              )}>
                {card.isPositive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                {card.change}
              </div>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{card.label}</p>
              <h3 className="text-2xl font-bold text-slate-900">{card.value}</h3>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Sales Chart */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-white p-6 rounded-2xl border border-slate-100 shadow-premium"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
              {chartType === 'bar' && <BarChart3 size={20} />}
              {chartType === 'line' && <LineChartIcon size={20} />}
              {chartType === 'pie' && <PieChartIcon size={20} />}
            </div>
            <div>
              <h3 className="font-bold text-slate-900">Grafik Penjualan Mingguan</h3>
              <p className="text-xs text-slate-500 font-medium">Data transaksi 7 hari terakhir</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-100 self-start">
            <button 
              onClick={() => setChartType('bar')}
              className={cn(
                "p-1.5 rounded-lg transition-all",
                chartType === 'bar' ? "bg-white text-indigo-600 shadow-sm border border-slate-100" : "text-slate-400 hover:text-slate-600"
              )}
              title="Grafik Batang"
            >
              <BarChart3 size={16} />
            </button>
            <button 
              onClick={() => setChartType('line')}
              className={cn(
                "p-1.5 rounded-lg transition-all",
                chartType === 'line' ? "bg-white text-indigo-600 shadow-sm border border-slate-100" : "text-slate-400 hover:text-slate-600"
              )}
              title="Grafik Garis"
            >
              <LineChartIcon size={16} />
            </button>
            <button 
              onClick={() => setChartType('pie')}
              className={cn(
                "p-1.5 rounded-lg transition-all",
                chartType === 'pie' ? "bg-white text-indigo-600 shadow-sm border border-slate-100" : "text-slate-400 hover:text-slate-600"
              )}
              title="Grafik Lingkaran"
            >
              <PieChartIcon size={16} />
            </button>
          </div>
        </div>

        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            {renderChart()}
          </ResponsiveContainer>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-premium overflow-hidden">
          <div className="p-6 border-b border-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-slate-900">Riwayat Transaksi Terpercaya</h3>
              <p className="text-xs text-slate-500 font-medium">Data sirkulasi koin dan pembayaran tervalidasi</p>
            </div>
            <button 
              onClick={exportToPDF}
              disabled={isExporting}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border",
                isExporting 
                  ? "bg-slate-50 text-slate-400 border-slate-100 cursor-not-allowed" 
                  : "bg-white text-indigo-600 border-indigo-100 hover:bg-indigo-50 shadow-sm"
              )}
            >
              <Download size={14} className={isExporting ? "animate-bounce" : ""} />
              {isExporting ? 'Sedang Mencetak...' : 'Cetak Laporan PDF'}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 text-[10px] uppercase tracking-widest text-slate-400 font-bold">
                  <th className="px-6 py-4">Faktur</th>
                  <th className="px-6 py-4">Pelanggan</th>
                  <th className="px-6 py-4">Metode</th>
                  <th className="px-6 py-4">Jumlah</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {transactions.slice(0, 4).map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4 text-sm font-bold text-slate-900">{row.id}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm text-slate-900 font-bold">{row.user}</span>
                        <span className="text-[10px] text-slate-400 font-medium">{row.date}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 rounded bg-slate-100 text-slate-600 text-[9px] font-black uppercase">
                        {row.method}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-slate-900">Rp {row.amount.toLocaleString()}</td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                        row.status === 'lunas' ? "status-paid" : "status-pending"
                      )}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="p-1.5 text-slate-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-all">
                        <MoreHorizontal size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* System Health */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-premium">
            <h3 className="font-bold text-slate-900 mb-6">Kesehatan Sistem</h3>
            <div className="space-y-6">
              {[
                { label: 'Gerbang Pembayaran', status: 'Operasional', color: 'emerald', icon: CheckCircle2 },
                { label: 'Sinkronisasi Database', status: 'Sinkronisasi', color: 'amber', icon: Clock },
                { label: 'Sensor IoT', status: 'Aktif', color: 'emerald', icon: CheckCircle2 },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-${item.color}-50 text-${item.color}-600`}>
                      <item.icon size={16} />
                    </div>
                    <span className="text-sm font-bold text-slate-700">{item.label}</span>
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-wider text-${item.color}-600`}>
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-indigo-600 p-6 rounded-2xl text-white shadow-lg shadow-indigo-200 relative overflow-hidden group">
            <div className="relative z-10">
              <h4 className="font-bold mb-2">Dukungan Premium</h4>
              <p className="text-xs text-indigo-100 mb-4 font-medium">Butuh bantuan dengan sistem manajemen kantin Anda?</p>
              <button className="w-full py-2.5 bg-white text-indigo-600 rounded-xl text-xs font-bold hover:bg-indigo-50 transition-colors">
                Hubungi Dukungan
              </button>
            </div>
            <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
          </div>
        </div>
      </div>
    </div>
  );
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}

