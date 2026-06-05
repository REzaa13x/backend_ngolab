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
  Pie
} from 'recharts';
import { 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownRight, 
  Calendar, 
  Download, 
  PieChart as PieChartIcon,
  BarChart3,
  DollarSign,
  Package,
  Users,
  RefreshCw,
  CheckCircle2,
  XCircle,
  ExternalLink,
  FileText
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
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
  payment_proof?: string;
  source?: string;
  created_at: string;
  items: OrderItem[];
}

export default function SalesReport() {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [reportData, setReportData] = useState<any>(null);
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'year' | 'all'>('month');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'ngolab' | 'coworking' | 'smart_tag_qr' | 'manual'>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
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
      // Hanya tampilkan lunas atau gagal/tolak
      const isPaidOrFailed = 
        order.payment_status === 'lunas' || 
        order.payment_status === 'ditolak' || 
        order.status === 'dibatalkan';
        
      if (!isPaidOrFailed) return false;

      // Filter Sumber
      if (sourceFilter !== 'all') {
         const orderSource = order.source || 'ngolab';
         const isManual = order.external_id === 'MANUAL';
         if (sourceFilter === 'manual') {
            if (!isManual) return false;
         } else if (sourceFilter === 'ngolab') {
            if (orderSource !== 'ngolab' || isManual) return false;
         } else if (sourceFilter === 'coworking') {
            if (orderSource !== 'coworking' || isManual) return false;
         } else if (sourceFilter === 'smart_tag_qr') {
            if (orderSource !== 'smart_tag_qr' && orderSource !== 'smart_tag') return false;
         }
      }

      // Filter Waktu
      if (period === 'all') return true;

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
  }, [orders, period, sourceFilter]);

  const metrics = useMemo(() => {
    const lunasOrders = filteredOrders.filter(o => o.payment_status === 'lunas');
    const totalRevenue = lunasOrders.reduce((acc, o) => acc + o.total_price, 0);
    const totalOrders = lunasOrders.length;
    const avgOrder = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    
    return {
      revenue: totalRevenue,
      orders: totalOrders,
      avgOrder,
      customers: new Set(lunasOrders.map(o => o.user_id)).size
    };
  }, [filteredOrders]);

  const exportToPDF = () => {
    if (filteredOrders.length === 0) return;
    setIsExporting(true);
    const doc = new jsPDF();
    
    // Header Branding
    doc.setFontSize(24);
    doc.setTextColor(15, 23, 42); 
    doc.text('LAPORAN PENJUALAN', 14, 25);
    
    const displaySourceFilter = 
      sourceFilter === 'all' ? 'SEMUA SUMBER' :
      sourceFilter === 'ngolab' ? 'GESTURE EATS' :
      sourceFilter === 'coworking' ? 'COWORKING' :
      sourceFilter === 'smart_tag_qr' ? 'SMART TAG' : 'MANUAL';

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Periode: ${period.toUpperCase()} | Sumber: ${displaySourceFilter}`, 14, 32);
    doc.text(`Dicetak: ${new Date().toLocaleString('id-ID')}`, 14, 37);

    // Metrics Summary Box
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, 45, 182, 30, 3, 3, 'F');
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text('TOTAL PENDAPATAN', 20, 55);
    doc.text('TOTAL TRANSAKSI', 75, 55);
    doc.text('RATA-RATA ORDER', 130, 55);

    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text(`Rp ${metrics.revenue.toLocaleString()}`, 20, 65);
    doc.text(`${metrics.orders} Lunas`, 75, 65);
    doc.text(`Rp ${Math.round(metrics.avgOrder).toLocaleString()}`, 130, 65);

    // Table
    autoTable(doc, {
      startY: 85,
      head: [['Invoice', 'Pelanggan', 'Sumber', 'Status', 'Metode', 'Total']],
      body: filteredOrders.map(o => [
        o.invoice_number,
        o.customer_name,
        o.external_id === 'MANUAL' 
          ? `MANUAL (${o.source.toUpperCase()})` 
          : o.source === 'ngolab' 
            ? 'GESTURE EATS' 
            : o.source === 'coworking' 
              ? 'COWORKING' 
              : 'SMART TAG',
        o.payment_status === 'lunas' ? 'LUNAS' : 'GAGAL',
        o.payment_method || 'Tunai',
        `Rp ${o.total_price.toLocaleString()}`
      ]),
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
      theme: 'striped',
      styles: { fontSize: 8 },
      columnStyles: {
        5: { halign: 'right' }
      }
    });

    doc.save(`Laporan_${period}_${sourceFilter}_${Date.now()}.pdf`);
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
      {/* Header and Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-slate-900">Analisis Penjualan</h2>
          <p className="text-sm text-slate-500 font-medium mt-1">Laporan finansial dan daftar master riwayat transaksi.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-slate-50 border border-slate-100 p-1 rounded-xl shadow-inner">
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
                  "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                  period === p.id 
                    ? "bg-white text-indigo-600 shadow-sm border border-slate-200" 
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

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Pendapatan Bersih', value: `Rp ${metrics.revenue.toLocaleString()}`, trend: '+12.5%', isUp: true, icon: DollarSign, color: 'emerald' },
          { label: 'Pesanan Sukses', value: metrics.orders, trend: '+8.2%', isUp: true, icon: Package, color: 'indigo' },
          { label: 'Rata-rata Tagihan', value: `Rp ${Math.round(metrics.avgOrder).toLocaleString()}`, trend: '-2.4%', isUp: false, icon: TrendingUp, color: 'amber' },
          { label: 'Pelanggan Unik', value: metrics.customers, trend: '+18.7%', isUp: true, icon: Users, color: 'violet' },
        ].map((stat, idx) => (
          <div key={idx} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-lg transition-all duration-300">
            <div className="flex justify-between items-start mb-4">
               <div className={cn(
                 "w-12 h-12 rounded-2xl flex items-center justify-center",
                 stat.color === 'indigo' ? "bg-indigo-50 text-indigo-600" :
                 stat.color === 'emerald' ? "bg-emerald-50 text-emerald-600" :
                 stat.color === 'amber' ? "bg-amber-50 text-amber-600" :
                 "bg-violet-50 text-violet-600"
               )}>
                 <stat.icon size={22} />
               </div>
               <div className={cn(
                 "flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full",
                 stat.isUp ? "text-emerald-600 bg-emerald-50" : "text-rose-600 bg-rose-50"
               )}>
                 {stat.isUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                 {stat.trend}
               </div>
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">{stat.label}</p>
            <h3 className="text-2xl font-black text-slate-900 leading-none">{stat.value}</h3>
          </div>
        ))}
      </div>

      {/* Transaction Master History */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl overflow-hidden flex flex-col">
         {/* Filter Header */}
         <div className="px-8 py-6 border-b border-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
               <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                 <FileText className="text-indigo-600" size={20} />
                 Master Riwayat Transaksi
               </h3>
                <p className="text-xs text-slate-500 font-medium">Rekam jejak seluruh pesanan berdasarkan filter sumber.</p>
            </div>
            
            <div className="flex bg-slate-50 border border-slate-100 p-1 rounded-xl shadow-inner overflow-x-auto custom-scrollbar">
               {[
                 { id: 'all', label: 'Semua Sumber' },
                 { id: 'ngolab', label: 'Gesture Eats' },
                 { id: 'coworking', label: 'Coworking' },
                 { id: 'smart_tag_qr', label: 'Smart Tag' },
                 { id: 'manual', label: 'Manual' }
               ].map((s) => (
                 <button
                   key={s.id}
                   onClick={() => setSourceFilter(s.id as any)}
                   className={cn(
                     "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                     sourceFilter === s.id 
                       ? "bg-slate-900 text-white shadow-md" 
                       : "text-slate-500 hover:text-slate-800 hover:bg-white/50"
                   )}
                 >
                   {s.label}
                 </button>
               ))}
            </div>
         </div>

         {/* Table */}
         <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50">
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Faktur & Waktu</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Pelanggan</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-center">Sumber</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-right">Total</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-center">Status</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-center">Metode</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-8 py-16 text-center">
                       <div className="inline-flex flex-col items-center gap-3 opacity-50">
                          <Package size={40} className="text-slate-300" />
                          <span className="text-sm font-bold text-slate-400 italic">Tidak ada transaksi ditemukan.</span>
                       </div>
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/40 transition-colors group">
                      <td className="px-8 py-5">
                         <div className="flex flex-col">
                            <span className="text-sm font-black text-slate-900 leading-none">{row.invoice_number}</span>
                            <span className="text-[10px] text-slate-400 font-medium mt-1">
                               {new Date(row.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                            </span>
                         </div>
                      </td>
                      <td className="px-8 py-5">
                         <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-700 uppercase">{row.customer_name}</span>
                         </div>
                      </td>
                      <td className="px-8 py-5 text-center">
                         {row.external_id === 'MANUAL' ? (
                            <span className="px-2.5 py-1 rounded font-black uppercase tracking-widest text-[9px] bg-slate-100 text-slate-600 border border-slate-200">
                               Manual ({row.source})
                            </span>
                         ) : row.source === 'ngolab' ? (
                            <span className="px-2.5 py-1 rounded font-black uppercase tracking-widest text-[9px] bg-orange-50 text-orange-600">
                               Gesture Eats
                            </span>
                         ) : row.source === 'coworking' ? (
                            <span className="px-2.5 py-1 rounded font-black uppercase tracking-widest text-[9px] bg-blue-50 text-blue-600">
                               Coworking
                            </span>
                         ) : (
                            <span className="px-2.5 py-1 rounded font-black uppercase tracking-widest text-[9px] bg-purple-50 text-purple-600">
                               Smart Tag
                            </span>
                         )}
                      </td>
                      <td className="px-8 py-5 text-right">
                        <span className="text-sm font-black text-slate-900">Rp {row.total_price.toLocaleString()}</span>
                      </td>
                      <td className="px-8 py-5 text-center">
                         <span className={cn(
                           "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border",
                           row.payment_status === 'lunas' ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-rose-50 text-rose-600 border-rose-200"
                         )}>
                           {row.payment_status === 'lunas' ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                           {row.payment_status === 'lunas' ? 'Lunas' : 'Gagal'}
                         </span>
                      </td>
                      <td className="px-8 py-5 text-center">
                         <span className="px-2 py-1 bg-slate-100 text-slate-600 border border-slate-200 rounded font-black uppercase text-[9px]">
                           {row.payment_method || 'Tunai'}
                         </span>
                      </td>
                      <td className="px-8 py-5 text-right">
                         <button 
                           onClick={() => setSelectedOrder(row)}
                           className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-indigo-600 border border-indigo-100 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-indigo-50 hover:border-indigo-200 transition-all shadow-sm opacity-0 group-hover:opacity-100 focus:opacity-100"
                         >
                           <FileText size={12} /> Struk
                         </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
         </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-8 border-b border-slate-50 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <BarChart3 className="text-indigo-600" size={20} />
                Tren Penjualan Eksisting
              </h3>
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

        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-8 border-b border-slate-50">
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <PieChartIcon className="text-emerald-600" size={20} />
              Kategori Terlaris
            </h3>
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

      {/* Kwitansi Modal */}
      <AnimatePresence>
        {selectedOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden relative"
            >
              <div className="absolute top-0 left-0 right-0 h-4 bg-white z-10" style={{ 
                backgroundImage: 'radial-gradient(circle, #f1f5f9 2px, transparent 2px)',
                backgroundSize: '8px 8px',
                backgroundPosition: '0 0'
              }} />
              
              <div className="p-8 pb-4 flex flex-col items-center text-center">
                <div className={cn(
                  "w-16 h-16 rounded-full flex items-center justify-center mb-4",
                  selectedOrder.payment_status === 'lunas' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                )}>
                  {selectedOrder.payment_status === 'lunas' ? <CheckCircle2 size={32} /> : <XCircle size={32} />}
                </div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Kwitansi Digital</h3>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Status: {selectedOrder.payment_status === 'lunas' ? 'LUNAS' : 'GAGAL / DITOLAK'}</p>
              </div>

              <div className="px-8 space-y-4">
                 <div className="border-t border-dashed border-slate-200 pt-4 flex justify-between items-center">
                    <span className="text-[10px] font-black text-slate-400 uppercase">Pelanggan</span>
                    <span className="text-sm font-bold text-slate-900">{selectedOrder.customer_name}</span>
                 </div>
                 <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-slate-400 uppercase">Metode</span>
                    <span className="text-sm font-bold text-indigo-600">{selectedOrder.payment_method}</span>
                 </div>
                 <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-slate-400 uppercase">Sumber</span>
                    <span className="text-[11px] font-bold text-slate-700 uppercase">
                       {selectedOrder.external_id === 'MANUAL' 
                         ? `MANUAL (${selectedOrder.source})` 
                         : selectedOrder.source === 'ngolab' 
                           ? 'GESTURE EATS' 
                           : selectedOrder.source === 'coworking' 
                             ? 'COWORKING' 
                             : 'SMART TAG'}
                    </span>
                 </div>
                 <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-slate-400 uppercase">Waktu</span>
                    <span className="text-[11px] font-bold text-slate-700">{new Date(selectedOrder.created_at).toLocaleString('id-ID')}</span>
                 </div>
                 <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-slate-400 uppercase">No. Faktur</span>
                    <span className="text-[11px] font-mono font-bold text-slate-900">{selectedOrder.invoice_number}</span>
                 </div>
                 
                 <div className="border-t border-dashed border-slate-200 pt-4">
                    <span className="text-[10px] font-black text-slate-400 uppercase block mb-2">Item Pesanan:</span>
                    <div className="space-y-2">
                       {selectedOrder.items?.map((item, idx) => (
                          <div key={idx} className="flex justify-between text-[11px]">
                             <span className="text-slate-600 font-bold">{item.quantity}x {item.name}</span>
                             <span className="text-slate-900 font-black">Rp {(item.price * item.quantity).toLocaleString()}</span>
                          </div>
                       ))}
                    </div>
                 </div>

                 <div className="border-t-2 border-slate-900 pt-4 flex justify-between items-center">
                    <span className="text-[13px] font-black text-slate-900 uppercase">Total Tagihan</span>
                    <span className="text-lg font-black text-slate-900">Rp {(selectedOrder.total_price || 0).toLocaleString()}</span>
                 </div>

                 {selectedOrder.payment_proof && (
                    <div className="pt-4 animate-in slide-in-from-bottom-2 duration-500">
                       <span className="text-[10px] font-black text-slate-400 uppercase block mb-2">Lampiran Bukti:</span>
                       <div className="rounded-2xl overflow-hidden border border-slate-100 shadow-inner group relative">
                          <img 
                            src={selectedOrder.payment_proof} 
                            alt="Bukti Transfer" 
                            className="w-full h-32 object-cover transition-all group-hover:scale-105"
                            referrerPolicy="no-referrer"
                          />
                          <a 
                            href={selectedOrder.payment_proof} 
                            target="_blank" 
                            rel="noreferrer"
                            className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                             <ExternalLink className="text-white" size={24} />
                          </a>
                       </div>
                    </div>
                 )}
              </div>

              <div className="p-8 pt-6 flex flex-col gap-2">
                <button 
                  onClick={() => setSelectedOrder(null)}
                  className="w-full text-slate-400 py-2 text-[10px] font-black uppercase tracking-widest hover:text-slate-600 transition-colors"
                >
                  Tutup Kwitansi
                </button>
              </div>

              <div className="h-4 bg-white" style={{ 
                backgroundImage: 'linear-gradient(135deg, #f1f5f9 25%, transparent 25%), linear-gradient(225deg, #f1f5f9 25%, transparent 25%)',
                backgroundSize: '16px 16px',
                backgroundPosition: '0 0'
              }} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
