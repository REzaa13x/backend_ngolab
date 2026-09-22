import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  Search, 
  Filter, 
  MoreHorizontal, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  XCircle,
  ShoppingBag,
  ArrowUpDown,
  Zap,
  Download,
  Trash2,
  Check,
  RefreshCw,
  Plus,
  Minus,
  User,
  PhoneCall,
  Receipt,
  Printer
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import socket from '../lib/socket';
import { PaymentProofPreview } from './PaymentProofPreview';
import { authFetch } from '../lib/authFetch';
import { printReceipt } from '../lib/printDoc';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface OrderItem {
  name: string;
  quantity: number;
  price: number;
  image?: string | null;
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
  amount_paid?: number;
  external_id?: string;
  payment_proof?: string;
  payment_proof_url?: string;
  source: string;
  created_at: string;
  items: OrderItem[];
}

function normalizePaymentProof(order: Order): Order {
  return { ...order, payment_proof: order.payment_proof_url || order.payment_proof };
}

export default function OrderManagement() {
  const { user } = useAuth();
  const canManagePayments = user?.role === 'Super Admin' || user?.role === 'Kasir';
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [period, setPeriod] = useState<'all' | 'day' | 'week' | 'month' | 'year'>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');

  const fetchOrders = () => {
    setLoading(true);
    authFetch('/api/orders')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setOrders(data.map(normalizePaymentProof));
        } else {
          console.error("API did not return an array:", data);
          setOrders([]);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch orders:", err);
        setOrders([]);
        setLoading(false);
      });
  };

  const fetchSummary = () => {
    authFetch('/api/reports/summary')
      .then(res => res.json())
      .then(data => setSummary(data))
      .catch(err => console.error("Summary fetch failed:", err));
  };

  useEffect(() => {
    fetchOrders();
    fetchSummary();

    // Listen for real-time updates
    socket.on("new_order", (newOrder: Order) => {
      setOrders(prev => [normalizePaymentProof(newOrder), ...prev]);
    });

    socket.on("order_updated", (updatedOrder: Order) => {
      setOrders(prev => prev.map(o => o.id === updatedOrder.id ? normalizePaymentProof(updatedOrder) : o));
    });

    return () => {
      socket.off("new_order");
      socket.off("order_updated");
    };
  }, []);

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const matchesSearch = 
        (order.invoice_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (order.customer_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(order.id || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      if (!matchesSearch) return false;

      const orderSource = order.source || 'ngolab';
      const isManual = order.external_id === 'MANUAL';
      if (sourceFilter === 'ngolab') {
        if (orderSource !== 'ngolab' || isManual) return false;
      } else if (sourceFilter === 'coworking') {
        if (orderSource !== 'coworking' || isManual) return false;
      } else if (sourceFilter === 'smart_tag_qr') {
        if (orderSource !== 'smart_tag_qr' && orderSource !== 'smart_tag') return false;
      } else if (sourceFilter === 'manual') {
        if (!isManual) return false;
      }

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
  }, [orders, searchTerm, period, sourceFilter]);

  const verifyPayment = async (id: string, paymentDetails?: { method: string, amount: number }) => {
    try {
      const res = await authFetch(`/api/orders/${id}/verify`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-name': user?.name || 'Kasir'
        },
        body: JSON.stringify({
          payment_method: paymentDetails?.method,
          amount_paid: paymentDetails?.amount
        })
      });
      if (res.ok) {
        fetchOrders();
        fetchSummary();
        setSelectedOrder(null);
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(`Gagal memverifikasi pembayaran: ${errData.message || res.statusText}`);
      }
    } catch (err: any) {
      console.error("Verification failed:", err);
      alert(`Terjadi kesalahan jaringan: ${err.message}`);
    }
  };

  const updatePaymentStatus = async (id: string, paymentStatus: 'belum_bayar' | 'lunas') => {
    try {
      const res = await authFetch(`/api/orders/${id}/payment-status`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-name': user?.name || 'Kasir'
        },
        body: JSON.stringify({ payment_status: paymentStatus })
      });
      if (res.ok) {
        fetchOrders();
        fetchSummary();
        setSelectedOrder(null);
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(`Gagal mengubah status pembayaran: ${errData.message || res.statusText}`);
      }
    } catch (err: any) {
      console.error("Status update failed:", err);
      alert(`Terjadi kesalahan jaringan: ${err.message}`);
    }
  };



  const rejectOrder = async (id: string) => {
    if (!window.confirm("Apakah Anda yakin ingin menolak pembayaran ini? Pesanan akan dibatalkan.")) return;
    try {
      const res = await authFetch(`/api/orders/${id}/reject`, {
        method: 'POST',
        headers: {
          'x-user-name': user?.name || 'Kasir'
        }
      });
      if (res.ok) {
        fetchOrders();
        fetchSummary();
        setSelectedOrder(null);
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(`Gagal menolak pesanan: ${errData.message || res.statusText}`);
      }
    } catch (err: any) {
      console.error("Rejection failed:", err);
      alert(`Terjadi kesalahan jaringan: ${err.message}`);
    }
  };

  const deleteOrder = async (id: string) => {
    if (!confirm("Hapus pesanan ini?")) return;
    try {
      const res = await authFetch(`/api/orders/${id}`, {
        method: 'DELETE',
        headers: {
          'x-user-name': user?.name || 'Super Admin'
        }
      });
      if (res.ok) {
        fetchOrders();
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(`Gagal menghapus pesanan: ${errData.message || res.statusText}`);
      }
    } catch (err: any) {
      console.error("Delete failed:", err);
      alert(`Terjadi kesalahan jaringan: ${err.message}`);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      const res = await authFetch(`/api/orders/${id}/status`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-name': user?.name || 'Kasir'
        },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        fetchOrders();
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(`Gagal mengubah status pesanan: ${errData.message || res.statusText}`);
      }
    } catch (err: any) {
      console.error("Status update failed:", err);
      alert(`Terjadi kesalahan jaringan: ${err.message}`);
    }
  };

  const exportToPDF = () => {
    if (filteredOrders.length === 0) return;
    setIsExporting(true);
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(22);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text('LAPORAN TRANSAKSI', 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Periode: ${period.toUpperCase()}`, 14, 28);
    doc.text(`Waktu Cetak: ${new Date().toLocaleString('id-ID')}`, 14, 33);
    doc.text(`Total Pesanan: ${filteredOrders.length}`, 14, 38);
    
    const tableData = filteredOrders.map(o => [
      o.invoice_number,
      o.customer_name,
      new Date(o.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }),
      o.payment_method || 'Tunai',
      o.payment_status.toUpperCase(),
      `Rp ${o.total_price.toLocaleString()}`
    ]);

    autoTable(doc, {
      startY: 45,
      head: [['Invoice', 'Pelanggan', 'Waktu', 'Metode', 'Status', 'Total']],
      body: tableData,
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
      foot: [['', '', '', '', 'TOTAL AKHIR', `Rp ${filteredOrders.reduce((acc, curr) => acc + curr.total_price, 0).toLocaleString()}`]],
      footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
      theme: 'grid',
      styles: { fontSize: 8 },
      columnStyles: {
        5: { halign: 'right' }
      }
    });

    const fileName = `Laporan_Transaksi_${period}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
    setTimeout(() => setIsExporting(false), 800);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-slate-900">
            Verifikasi Transaksi {
              sourceFilter === 'all' ? '(Semua)' : 
              sourceFilter === 'ngolab' ? '(Gesture Eats)' : 
              sourceFilter === 'coworking' ? '(Coworking)' : 
              sourceFilter === 'smart_tag_qr' ? '(Smart Tag)' : 
              '(Manual)'
            }
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={exportToPDF}
            disabled={isExporting || filteredOrders.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-black transition-all shadow-lg shadow-slate-200 dark:shadow-none disabled:opacity-50 disabled:shadow-none"
          >
            {isExporting ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
            Cetak PDF
          </button>
          <div className="flex bg-white border border-slate-100 rounded-xl px-4 py-2 items-center gap-3 shadow-sm">
             <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Status Gateway:</span>
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Online</span>
             </div>
          </div>
          <button 
            onClick={fetchOrders}
            className="p-2.5 bg-white border border-slate-100 rounded-xl text-slate-400 hover:text-indigo-600 transition-all shadow-sm group"
          >
            <RefreshCw size={18} className={loading ? "animate-spin" : "group-active:rotate-180 transition-transform"} />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-premium overflow-hidden">
        <div className="p-5 border-b border-slate-50 bg-slate-50/20 flex flex-col sm:flex-row items-center gap-4">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Cari faktur, ID pelanggan, atau nominal..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-slate-100 rounded-2xl pl-12 pr-4 py-3 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-sm"
            />
          </div>
           <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap">
              {/* Filter Outlet */}
              <div className="flex items-center gap-1 bg-white border border-slate-100 rounded-2xl p-1 shadow-sm">
                 {[
                   { id: 'all', label: 'Semua' },
                   { id: 'ngolab', label: 'Gesture Eats' },
                   { id: 'coworking', label: 'Coworking' },
                   { id: 'smart_tag_qr', label: 'Smart Tag' },
                   { id: 'manual', label: 'Manual' }
                 ].map(s => (
                   <button
                     key={s.id}
                     onClick={() => setSourceFilter(s.id)}
                     className={cn(
                       "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                       sourceFilter === s.id 
                         ? s.id === 'ngolab' 
                           ? "bg-orange-600 text-white shadow-md shadow-orange-200 dark:shadow-none"
                           : s.id === 'coworking'
                             ? "bg-blue-600 text-white shadow-md shadow-blue-200 dark:shadow-none"
                             : s.id === 'smart_tag_qr'
                               ? "bg-purple-600 text-white shadow-md shadow-purple-200 dark:shadow-none"
                               : "bg-slate-900 text-white shadow-md"
                         : "text-slate-500 hover:bg-slate-50"
                     )}
                   >
                     {s.label}
                   </button>
                 ))}
              </div>

              {/* Filter Waktu */}
              <div className="flex items-center gap-1 bg-white border border-slate-100 rounded-2xl p-1 shadow-sm">
                 {[
                   { id: 'all', label: 'Semua Waktu' },
                   { id: 'day', label: 'Hari Ini' },
                   { id: 'week', label: 'Minggu Ini' },
                   { id: 'month', label: 'Bulan Ini' }
                 ].map(p => (
                   <button
                     key={p.id}
                     onClick={() => setPeriod(p.id as any)}
                     className={cn(
                       "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                       period === p.id 
                         ? "bg-slate-900 text-white shadow-md" 
                         : "text-slate-500 hover:bg-slate-50"
                     )}
                   >
                     {p.label}
                   </button>
                 ))}
              </div>
           </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-300  dark: text-[10px] uppercase tracking-widest  font-black border-b border-slate-50">
                <th className="px-6 py-5">Pesanan &amp; Barang</th>
                <th className="px-6 py-5">Info Bayar</th>
                <th className="px-6 py-5 text-right">Total</th>
                <th className="px-6 py-5 text-center">Status</th>
                <th className="px-6 py-5 text-center">Validasi</th>
                <th className="px-6 py-5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading && orders.length === 0 ? (
                <tr>
                   <td colSpan={6} className="px-6 py-20 text-center">
                      <div className="inline-flex items-center gap-3 px-6 py-3 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest animate-pulse">
                         <RefreshCw size={14} className="animate-spin" /> Mengambil Data...
                      </div>
                   </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-4 opacity-50">
                       <ShoppingBag size={48} className="text-slate-200" />
                       <p className="text-sm font-bold text-slate-400">Belum ada pesanan.</p>
                    </div>
                  </td>
                </tr>
              ) : filteredOrders.map((order) => (
                <tr key={order.id} className="hover:bg-slate-50/30 transition-colors group align-top">
                  <td className="px-6 py-5">
                    <div className="flex flex-col max-w-[280px]">
                      <span className="text-sm font-black text-slate-900 leading-none">{order.invoice_number}</span>
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <span className="text-[9px] text-indigo-600 font-black uppercase tracking-widest leading-none">
                          {order.customer_name}
                        </span>
                        <span className="text-[9px] bg-slate-100 text-slate-400 px-1 py-0.5 rounded leading-none">
                          ID:{order.user_id || 'Tamu'}
                        </span>
                        {order.external_id === 'MANUAL' ? (
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-widest leading-none bg-slate-100 text-slate-600 border border-slate-200">
                            Manual ({order.source})
                          </span>
                        ) : order.source === 'ngolab' ? (
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-widest leading-none bg-orange-50 text-orange-600">
                            Gesture Eats
                          </span>
                        ) : order.source === 'coworking' ? (
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-widest leading-none bg-blue-50 text-blue-700 border border-blue-100">
                            Coworking
                          </span>
                        ) : (
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-widest leading-none bg-purple-50 text-purple-600">
                            Smart Tag
                          </span>
                        )}
                      </div>
                      {/* Nama barang + harga satuan, supaya kasir tidak perlu membuka struk */}
                      <div className="mt-2.5 pt-2 border-t border-dashed border-slate-200 space-y-1">
                        {order.items?.length ? order.items.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between gap-3 text-[11px]">
                            <span className="flex items-center gap-1.5 min-w-0">
                              {item.image && (
                                <img
                                  src={item.image}
                                  alt={item.name}
                                  className="w-5 h-5 rounded object-cover border border-slate-100 shrink-0"
                                  referrerPolicy="no-referrer"
                                />
                              )}
                              <span className="font-bold text-slate-700 truncate">{item.quantity}x {item.name}</span>
                            </span>
                            <span className="font-bold text-slate-500 shrink-0 whitespace-nowrap">
                              @ Rp {Number(item.price || 0).toLocaleString()}
                            </span>
                          </div>
                        )) : (
                          <span className="text-[10px] text-slate-300 italic">Tanpa rincian item</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-600">{order.payment_method || 'Tunai'}</span>
                        {order.payment_proof && (
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {new Date(order.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} • {order.external_id || '-'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <span className="text-sm font-black text-slate-900">Rp {(order.total_price || 0).toLocaleString()}</span>
                  </td>
                  {/* KOLOM STATUS (Read Only) */}
                  <td className="px-6 py-5 text-center">
                    <span className={cn(
                      "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest inline-flex items-center gap-1.5",
                      order.payment_status === 'lunas'
                        ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                        : order.payment_status === 'pending_verifikasi'
                          ? "bg-amber-50 text-amber-700 border border-amber-200"
                          : "bg-rose-50 text-rose-600 border border-rose-200"
                    )}>
                      {order.payment_status === 'lunas' ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                      {order.payment_status === 'lunas' ? 'Lunas' : order.payment_status === 'pending_verifikasi' ? 'Menunggu Verifikasi' : 'Belum Bayar'}
                    </span>
                  </td>

                  {/* KOLOM VALIDASI */}
                  <td className="px-6 py-5">
                    <div className="flex items-center justify-center">
                      {canManagePayments ? (order.payment_status === 'lunas' ? (
                        <button
                          onClick={() => updatePaymentStatus(order.id, 'belum_bayar')}
                          className="px-3 py-2 bg-rose-50 text-rose-600 border border-rose-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-100 transition-all shadow-sm flex items-center gap-1.5"
                        >
                          <Minus size={12} /> Set Belum Bayar
                        </button>
                      ) : (
                        <button
                          onClick={() => updatePaymentStatus(order.id, 'lunas')}
                          className="px-3 py-2 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-all shadow-sm flex items-center gap-1.5"
                        >
                          <Check size={12} /> Set Lunas
                        </button>
                      )) : <span className="text-xs text-slate-300">—</span>}
                    </div>
                  </td>
                  
                  <td className="px-6 py-5 text-right">
                    <div className="flex items-center justify-end gap-2">
                       <button 
                         onClick={() => setSelectedOrder(order)}
                         className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all flex items-center gap-1"
                       >
                         <Receipt size={12} /> Lihat Struk
                       </button>
                       {canManagePayments && (
                         <button
                          onClick={() => deleteOrder(order.id)}
                          className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                         >
                           <Trash2 size={14} />
                         </button>
                       )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cash Modal Removed */}

      {/* Modal Bukti Transaksi Ala Struk */}
      <AnimatePresence>
        {selectedOrder && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-sm rounded-[2rem] overflow-hidden shadow-2xl relative flex flex-col"
            >
              {/* Receipt Header Paper Pattern */}
              <div className="absolute top-0 left-0 right-0 h-4 bg-white z-10" style={{ 
                backgroundImage: 'radial-gradient(circle, #f1f5f9 2px, transparent 2px)',
                backgroundSize: '8px 8px',
                backgroundPosition: '0 0'
              }} />
              
              <div className="p-8 pb-4 flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle2 size={32} />
                </div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Kwitansi Digital</h3>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Status: {(selectedOrder.payment_status || 'belum_bayar').replace('_', ' ')}</p>
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
                    <span className="text-[13px] font-black text-slate-900 uppercase">Total Bayar</span>
                    <span className="text-lg font-black text-slate-900">Rp {(selectedOrder.total_price || 0).toLocaleString()}</span>
                 </div>

                 {/* Bukti Bayar Image Preview */}
                 {canManagePayments && selectedOrder.payment_proof && (
                    <div className="pt-4 animate-in slide-in-from-bottom-2 duration-500">
                       <span className="text-[10px] font-black text-slate-400 uppercase block mb-2">Lampiran Bukti:</span>
                       <PaymentProofPreview url={selectedOrder.payment_proof} />
                    </div>
                 )}
              </div>

              <div className="p-8 pt-6 flex flex-col gap-2">
                {canManagePayments && selectedOrder.payment_status === 'pending_verifikasi' ? (
                  <div className="flex gap-2">
                    <button 
                      onClick={() => verifyPayment(selectedOrder.id)}
                      className="flex-1 bg-emerald-600 text-white py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 dark:shadow-none"
                    >
                      Terima & Proses
                    </button>
                    <button 
                      onClick={() => rejectOrder(selectedOrder.id)}
                      className="px-4 bg-rose-50 text-rose-600 py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-rose-100 transition-all"
                    >
                      Tolak
                    </button>
                  </div>
                ) : (
                  <button 
                    disabled
                    className="w-full bg-slate-100 text-slate-400 py-3 rounded-xl text-xs font-black uppercase tracking-widest italic"
                  >
                    {canManagePayments ? 'Sudah Terverifikasi' : 'Hanya Kasir/Admin yang dapat memverifikasi'}
                  </button>
                )}
                <button 
                  onClick={() => {
                    if (!printReceipt(selectedOrder)) {
                      alert('Popup diblokir browser. Izinkan popup untuk mencetak struk.');
                    }
                  }}
                  className="w-full bg-slate-900 text-white py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-black transition-all flex items-center justify-center gap-2 shadow-lg shadow-slate-200 dark:shadow-none"
                >
                  <Printer size={14} /> Cetak Struk
                </button>

                <button 
                  onClick={() => setSelectedOrder(null)}
                  className="w-full text-slate-400 py-2 text-[10px] font-black uppercase tracking-widest hover:text-slate-600 transition-colors"
                >
                  Tutup Detail
                </button>
              </div>

              {/* Receipt Bottom Paper Pattern */}
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

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}
