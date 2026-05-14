import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart, 
  Pie,
  Legend
} from 'recharts';
import { 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownRight, 
  Calendar, 
  Download, 
  Filter,
  PieChart as PieChartIcon,
  BarChart3,
  DollarSign,
  Package,
  Users,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { motion } from 'motion/react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

interface Order {
  id: string;
  user_id: string;
  customer_name: string;
  invoice_number: string;
  total_price: number;
  status: string;
  payment_status: string;
  payment_method?: string;
  created_at: string;
  items: OrderItem[];
}

export default function SalesReport() {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [reportData, setReportData] = useState<any>(null);
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'year' | 'all'>('month');
  const [isExporting, setIsExporting] = useState(false);

  const fetchFullData = async () => {
    setLoading(true);
    try {
      const [ordersRes, reportRes] = await Promise.all([
        fetch('/api/orders'),
        fetch('/api/reports/monthly')
      ]);
      
      const ordersData = await ordersRes.json();
      const reportAgg = await reportRes.json();
      
      setOrders(ordersData);
      setReportData(reportAgg);
    } catch (err) {
      console.error("Report fetch failed:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFullData();
  }, []);

  const filteredOrders = useMemo(() => {
    if (!orders.length) return [];
    
    return orders.filter(order => {
      if (period === 'all') return true;
      if (order.payment_status !== 'lunas') return false;

      const orderDate = new Date(order.created_at);
      const now = new Date();

      if (period === 'day') {
        return orderDate.toDateString() === now.toDateString();
      }

      if (period === 'week') {
        const weekAgo = new Date();
        weekAgo.setDate(now.getDate() - 7);
        return orderDate >= weekAgo;
      }

      if (period === 'month') {
        return orderDate.getMonth() === now.getMonth() && orderDate.getFullYear() === now.getFullYear();
      }

      if (period === 'year') {
        return orderDate.getFullYear() === now.getFullYear();
      }

      return true;
    });
  }, [orders, period]);

  const metrics = useMemo(() => {
    const totalRevenue = filteredOrders.reduce((acc, o) => acc + o.total_price, 0);
    const totalOrders = filteredOrders.length;
    const avgOrder = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    
    // In a real app we'd compare with previous period
    return {
      revenue: totalRevenue,
      orders: totalOrders,
      avgOrder,
      customers: new Set(filteredOrders.map(o => o.user_id)).size
    };
  }, [filteredOrders]);

  const exportToPDF = () => {
    if (filteredOrders.length === 0) return;
    setIsExporting(true);
    const doc = new jsPDF();
    
    // Header Branding
    doc.setFontSize(24);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text('LAPORAN PENJUALAN', 14, 25);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Periode: ${period.toUpperCase()}`, 14, 32);
    doc.text(`Dicetak: ${new Date().toLocaleString('id-ID')}`, 14, 37);

    // Metrics Summary Box
    doc.setFillColor(248, 250, 252); // slate-50
    doc.roundedRect(14, 45, 182, 30, 3, 3, 'F');
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text('TOTAL PENDAPATAN', 20, 55);
    doc.text('TOTAL TRANSAKSI', 75, 55);
    doc.text('RATA-RATA ORDER', 130, 55);

    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text(`Rp ${metrics.revenue.toLocaleString()}`, 20, 65);
    doc.text(`${metrics.orders} Pesanan`, 75, 65);
    doc.text(`Rp ${Math.round(metrics.avgOrder).toLocaleString()}`, 130, 65);

    // Table
    autoTable(doc, {
      startY: 85,
      head: [['Invoice', 'Pelanggan', 'Tanggal', 'Metode', 'Total']],
      body: filteredOrders.map(o => [
        o.invoice_number,
        o.customer_name,
        new Date(o.created_at).toLocaleDateString('id-ID'),
        o.payment_method || 'Tunai',
        `Rp ${o.total_price.toLocaleString()}`
      ]),
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
      theme: 'striped',
      styles: { fontSize: 8 },
      columnStyles: {
        4: { halign: 'right' }
      }
    });

    doc.save(`Laporan_Penjualan_${period}_${Date.now()}.pdf`);
    setTimeout(() => setIsExporting(false), 800);
  };

  if (loading || !reportData) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-black uppercase tracking-widest text-slate-400">Menyiapkan Laporan...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-slate-900">Statistik Penjualan</h2>
          <p className="text-sm text-slate-500 font-medium mt-1">Analisis performa bisnis berdasarkan periode waktu terpilih.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-white border border-slate-100 p-1 rounded-xl shadow-sm">
            {[
              { id: 'day', label: 'Hari' },
              { id: 'week', label: 'Minggu' },
              { id: 'month', label: 'Bulan' },
              { id: 'year', label: 'Tahun' },
              { id: 'all', label: 'Semua' }
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id as any)}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                  period === p.id 
                    ? "bg-slate-900 text-white shadow-md" 
                    : "text-slate-400 hover:text-slate-600"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button 
            onClick={exportToPDF}
            disabled={isExporting || filteredOrders.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50"
          >
            {isExporting ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
            Eksport PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Total Pendapatan', value: `Rp ${metrics.revenue.toLocaleString()}`, trend: '+12.5%', isUp: true, icon: DollarSign, color: 'indigo' },
          { label: 'Pesanan Sukses', value: metrics.orders, trend: '+8.2%', isUp: true, icon: Package, color: 'emerald' },
          { label: 'Rata-rata Order', value: `Rp ${Math.round(metrics.avgOrder).toLocaleString()}`, trend: '-2.4%', isUp: false, icon: TrendingUp, color: 'amber' },
          { label: 'Pelanggan Unik', value: metrics.customers, trend: '+18.7%', isUp: true, icon: Users, color: 'violet' },
        ].map((stat, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="group relative bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
          >
            <div className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110",
              stat.color === 'indigo' ? "bg-indigo-50 text-indigo-600 shadow-indigo-100/50" :
              stat.color === 'emerald' ? "bg-emerald-50 text-emerald-600 shadow-emerald-100/50" :
              stat.color === 'amber' ? "bg-amber-50 text-amber-600 shadow-amber-100/50" :
              "bg-violet-50 text-violet-600 shadow-violet-100/50"
            )}>
              <stat.icon size={22} />
            </div>
            
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">{stat.label}</p>
            <div className="flex items-end justify-between">
              <h3 className="text-2xl font-black text-slate-900 leading-none">{stat.value}</h3>
              <div className={cn(
                "flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full",
                stat.isUp ? "text-emerald-600 bg-emerald-50" : "text-rose-600 bg-rose-50"
              )}>
                {stat.isUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                {stat.trend}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white rounded-[2.5rem] border border-slate-100 shadow-xl overflow-hidden flex flex-col">
          <div className="p-8 border-b border-slate-50 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <BarChart3 className="text-indigo-600" size={20} />
                Tren Penjualan Eksisting
              </h3>
              <p className="text-xs text-slate-500 font-medium">Data performa berdasarkan dataset yang terekam.</p>
            </div>
          </div>
          
          <div className="p-8 flex-1 min-h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={reportData.monthlyData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} 
                  tickFormatter={(val) => `Rp${val/1000}k`}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ 
                    borderRadius: '1.25rem', 
                    border: 'none', 
                    boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                    padding: '1rem'
                  }}
                  itemStyle={{ fontSize: '12px', fontWeight: 900, color: '#1e293b' }}
                  labelStyle={{ fontSize: '10px', fontWeight: 900, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}
                />
                <Bar dataKey="sales" radius={[8, 8, 0, 0]} barSize={40}>
                  {reportData.monthlyData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={index === reportData.monthlyData.length - 1 ? '#4f46e5' : '#e2e8f0'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl overflow-hidden flex flex-col">
          <div className="p-8 border-b border-slate-50">
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <PieChartIcon className="text-emerald-600" size={20} />
              Kategori Terlaris
            </h3>
            <p className="text-xs text-slate-500 font-medium">Distribusi pendapatan jenis menu.</p>
          </div>
          
          <div className="p-4 flex-1 flex flex-col items-center justify-center">
            <div className="w-full h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={reportData.categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={8}
                    dataKey="value"
                    stroke="none"
                  >
                    {reportData.categoryData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            <div className="w-full space-y-3 px-6 pb-8">
               {reportData.categoryData.map((cat: any, index: number) => (
                  <div key={index} className="flex items-center justify-between group">
                     <div className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                        <span className="text-xs font-black text-slate-700 group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{cat.name}</span>
                     </div>
                     <span className="text-xs font-mono font-bold text-slate-400">Rp {(cat.value/1000000).toFixed(1)}M</span>
                  </div>
               ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl overflow-hidden">
        <div className="px-8 py-6 border-b border-slate-50 bg-slate-50/30">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
            <Calendar size={16} className="text-indigo-600" />
            Rekapitulasi Transaksi Terpilih ({period})
          </h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-50">
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Invoice</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Pelanggan</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Waktu</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Total Tagihan</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Metode</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-8 py-12 text-center text-sm font-bold text-slate-400 italic">
                    Tidak ada data untuk periode ini.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/50 transition-colors font-bold">
                    <td className="px-8 py-6 text-sm text-slate-900">{row.invoice_number}</td>
                    <td className="px-8 py-6 text-sm text-slate-600 uppercase text-[10px] tracking-tight">{row.customer_name}</td>
                    <td className="px-8 py-6 text-[10px] text-slate-400 uppercase">
                      {new Date(row.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                    </td>
                    <td className="px-8 py-6 text-sm text-right text-slate-900">
                      Rp {row.total_price.toLocaleString()}
                    </td>
                    <td className="px-8 py-6 text-right">
                       <span className="text-[9px] font-black uppercase text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md">
                          {row.payment_method || 'Tunai'}
                       </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
