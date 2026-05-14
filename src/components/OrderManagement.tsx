import React, { useEffect, useState, useMemo } from 'react';
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
  ExternalLink,
  Zap,
  Download,
  Trash2,
  Check,
  RefreshCw,
  Plus,
  Minus,
  User,
  PhoneCall
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import socket from '../lib/socket';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
  amount_paid?: number;
  external_id?: string;
  payment_proof?: string;
  created_at: string;
  items: OrderItem[];
}

export default function OrderManagement() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [period, setPeriod] = useState<'all' | 'day' | 'week' | 'month' | 'year'>('all');
  const [isCashModalOpen, setIsCashModalOpen] = useState(false);
  const [cashAmount, setCashAmount] = useState<string>('');
  const [cashOrder, setCashOrder] = useState<Order | null>(null);

  // Manual Order States
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualCustomerName, setManualCustomerName] = useState('');
  const [selectedItems, setSelectedItems] = useState<{ id: number, quantity: number }[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [searchMenu, setSearchMenu] = useState('');
  const [manualSubmitting, setManualSubmitting] = useState(false);

  const fetchOrders = () => {
    setLoading(true);
    fetch('/api/orders')
      .then(res => res.json())
      .then(data => {
        setOrders(data);
        setLoading(false);
      });
  };

  const fetchSummary = () => {
    fetch('/api/reports/summary')
      .then(res => res.json())
      .then(data => setSummary(data))
      .catch(err => console.error("Summary fetch failed:", err));
  };

  const fetchMenu = () => {
    fetch('/api/menu')
      .then(res => res.json())
      .then(data => setMenuItems(data))
      .catch(err => console.error("Menu fetch failed:", err));
  };

  useEffect(() => {
    fetchOrders();
    fetchSummary();
    fetchMenu();

    // Listen for real-time updates
    socket.on("new_order", (newOrder: Order) => {
      setOrders(prev => [newOrder, ...prev]);
    });

    socket.on("order_updated", (updatedOrder: Order) => {
      setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
    });

    return () => {
      socket.off("new_order");
      socket.off("order_updated");
    };
  }, []);

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const matchesSearch = 
        order.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.id.toLowerCase().includes(searchTerm.toLowerCase());
      
      if (!matchesSearch) return false;

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
  }, [orders, searchTerm, period]);

  const verifyPayment = async (id: string, paymentDetails?: { method: string, amount: number }) => {
    try {
      const res = await fetch(`/api/orders/${id}/verify`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_method: paymentDetails?.method,
          amount_paid: paymentDetails?.amount
        })
      });
      if (res.ok) {
        fetchOrders();
        fetchSummary();
        setSelectedOrder(null);
        setIsCashModalOpen(false);
        setCashOrder(null);
        setCashAmount('');
      }
    } catch (err) {
      console.error("Verification failed:", err);
    }
  };

  const handleCashPayment = (order: Order) => {
    setCashOrder(order);
    setIsCashModalOpen(true);
    setCashAmount('');
  };

  const changeValue = useMemo(() => {
    if (!cashOrder || !cashAmount) return 0;
    const cash = parseFloat(cashAmount) || 0;
    return Math.max(0, cash - cashOrder.total_price);
  }, [cashOrder, cashAmount]);

  const rejectOrder = async (id: string) => {
    if (!window.confirm("Apakah Anda yakin ingin menolak pembayaran ini? Pesanan akan dibatalkan.")) return;
    try {
      const res = await fetch(`/api/orders/${id}/reject`, { method: 'POST' });
      if (res.ok) {
        fetchOrders();
        fetchSummary();
        setSelectedOrder(null);
      }
    } catch (err) {
      console.error("Rejection failed:", err);
    }
  };

  const deleteOrder = async (id: string) => {
    if (!confirm("Hapus pesanan ini?")) return;
    try {
      const res = await fetch(`/api/orders/${id}`, { method: 'DELETE' });
      if (res.ok) fetchOrders();
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const submitManualOrder = async () => {
    if (!manualCustomerName || selectedItems.length === 0) return;
    setManualSubmitting(true);
    try {
      const res = await fetch('/api/orders/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: manualCustomerName,
          items: selectedItems,
          payment_status: 'belum_bayar' // Initially pending
        })
      });
      if (res.ok) {
        setIsManualModalOpen(false);
        setManualCustomerName('');
        setSelectedItems([]);
        fetchOrders();
        fetchSummary();
      }
    } catch (err) {
      console.error("Manual order failed:", err);
    } finally {
      setManualSubmitting(false);
    }
  };

  const addToManualOrder = (id: number) => {
    setSelectedItems(prev => {
      const existing = prev.find(i => i.id === id);
      if (existing) {
        return prev.map(i => i.id === id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { id, quantity: 1 }];
    });
  };

  const removeFromManualOrder = (id: number) => {
    setSelectedItems(prev => {
      const existing = prev.find(i => i.id === id);
      if (existing && existing.quantity > 1) {
        return prev.map(i => i.id === id ? { ...i, quantity: i.quantity - 1 } : i);
      }
      return prev.filter(i => i.id !== id);
    });
  };

  const manualOrderTotal = useMemo(() => {
    return selectedItems.reduce((acc, curr) => {
      const item = menuItems.find(m => m.id === curr.id);
      return acc + (item ? item.price * curr.quantity : 0);
    }, 0);
  }, [selectedItems, menuItems]);

  const filteredMenu = useMemo(() => {
    return menuItems.filter(m => 
      m.name.toLowerCase().includes(searchMenu.toLowerCase()) || 
      m.category.toLowerCase().includes(searchMenu.toLowerCase())
    );
  }, [menuItems, searchMenu]);

  const updateStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/orders/${id}/status`, { 
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res.ok) fetchOrders();
    } catch (err) {
      console.error("Status update failed:", err);
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
          <h2 className="text-2xl font-black tracking-tight text-slate-900">Verifikasi Transaksi</h2>
          <p className="text-sm text-slate-500 font-medium tracking-tight">Validasi pembayaran dan monitoring arus pesanan real-time.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsManualModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
          >
            <PhoneCall size={14} />
            Pesanan Manual
          </button>
          <button 
            onClick={exportToPDF}
            disabled={isExporting || filteredOrders.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-black transition-all shadow-lg shadow-slate-200 disabled:opacity-50 disabled:shadow-none"
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
          <div className="flex items-center gap-2 w-full sm:w-auto">
             <div className="flex items-center gap-1 bg-white border border-slate-100 rounded-2xl p-1 shadow-sm">
                {[
                  { id: 'all', label: 'Semua' },
                  { id: 'day', label: 'Hari Ini' },
                  { id: 'week', label: 'Minggu' },
                  { id: 'month', label: 'Bulan' },
                  { id: 'year', label: 'Tahun' }
                ].map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPeriod(p.id as any)}
                    className={cn(
                      "px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all",
                      period === p.id 
                        ? "bg-slate-900 text-white shadow-md shadow-slate-200" 
                        : "text-slate-400 hover:text-slate-600"
                    )}
                  >
                    {p.label}
                  </button>
                ))}
             </div>
             <button className="px-5 py-3 bg-white border border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600 transition-colors shadow-sm flex items-center gap-2 shrink-0">
                <Filter size={16} /> Filter
             </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 text-[10px] uppercase tracking-widest text-slate-400 font-black border-b border-slate-50">
                <th className="px-6 py-5">Pesanan</th>
                <th className="px-6 py-5">Info Bayar</th>
                <th className="px-6 py-5 text-right">Total</th>
                <th className="px-6 py-5 text-center">Status</th>
                <th className="px-6 py-5">Validasi</th>
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
                <tr key={order.id} className="hover:bg-slate-50/30 transition-colors group">
                  <td className="px-6 py-5">
                    <div className="flex flex-col">
                      <span className="text-sm font-black text-slate-900 leading-none">{order.invoice_number}</span>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span className="text-[9px] text-indigo-600 font-black uppercase tracking-widest leading-none">
                          {order.customer_name}
                        </span>
                        <span className="text-[9px] bg-slate-100 text-slate-400 px-1 py-0.5 rounded leading-none">
                          ID:{order.user_id}
                        </span>
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
                    <span className="text-sm font-black text-slate-900">Rp {order.total_price.toLocaleString()}</span>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex justify-center">
                      <span className={cn(
                        "px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5",
                        order.payment_status === 'lunas' 
                          ? "bg-emerald-50 text-emerald-600 border border-emerald-100" 
                          : order.payment_status === 'pending_verifikasi'
                            ? "bg-amber-50 text-amber-600 border border-amber-100"
                            : "bg-rose-50 text-rose-600 border border-rose-100"
                      )}>
                        {order.payment_status.replace('_', ' ')}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex flex-col gap-1.5">
                      {order.payment_proof ? (
                        <button 
                          onClick={() => setSelectedOrder(order)}
                          className="w-full text-center py-1.5 bg-emerald-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-sm"
                        >
                          Cek Bukti
                        </button>
                      ) : (order.payment_status === 'pending_verifikasi' || order.payment_status === 'belum_bayar') ? (
                        <div className="flex flex-col gap-1">
                          <button 
                            onClick={() => handleCashPayment(order)}
                            className="w-full text-center py-1.5 bg-slate-900 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-sm"
                          >
                            Bayar Tunai
                          </button>
                          {order.payment_status === 'pending_verifikasi' && (
                            <button 
                              onClick={() => verifyPayment(order.id, { method: 'QRIS', amount: order.total_price })}
                              className="w-full text-center py-1.2 bg-indigo-50 text-indigo-600 rounded-lg text-[9px] font-bold uppercase tracking-tighter hover:bg-indigo-100 transition-all border border-indigo-100"
                            >
                              Verifikasi QRIS
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest text-center italic">Menunggu...</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex items-center justify-end gap-2">
                       <button 
                        onClick={() => deleteOrder(order.id)}
                        className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                       >
                         <Trash2 size={16} />
                       </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {isManualModalOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.95 }}
              className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden"
            >
              {/* Modal Header */}
              <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100">
                    <PhoneCall size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900">Buat Pesanan Manual</h3>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Input pesanan via Telepon atau Walk-in</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsManualModalOpen(false)}
                  className="p-3 bg-white text-slate-300 hover:text-slate-600 rounded-2xl transition-all border border-slate-100 shadow-sm"
                >
                  <XCircle size={24} />
                </button>
              </div>

              <div className="flex-1 flex overflow-hidden">
                {/* Left Side: Product Selector */}
                <div className="flex-[3] p-8 overflow-y-auto bg-white space-y-6">
                   <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input 
                        type="text" 
                        placeholder="Cari Menu atau Kategori..."
                        value={searchMenu}
                        onChange={(e) => setSearchMenu(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-12 pr-4 py-4 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                      />
                   </div>

                   <div className="grid grid-cols-2 gap-4">
                      {filteredMenu.map((item) => (
                        <div 
                          key={item.id}
                          className="group bg-white border border-slate-100 p-4 rounded-3xl hover:border-indigo-600 hover:shadow-xl hover:shadow-indigo-50/50 transition-all cursor-pointer relative"
                          onClick={() => addToManualOrder(item.id)}
                        >
                           <div className="flex gap-4">
                              <img src={item.image} className="w-16 h-16 rounded-2xl object-cover shadow-sm border border-slate-50" referrerPolicy="no-referrer" />
                              <div className="flex-1">
                                 <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1 block">{item.category}</span>
                                 <h4 className="text-xs font-black text-slate-900 line-clamp-2 leading-tight">{item.name}</h4>
                                 <p className="text-sm font-black text-slate-900 mt-1">Rp {item.price.toLocaleString()}</p>
                              </div>
                           </div>
                           <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <div className="p-1.5 bg-indigo-600 text-white rounded-xl shadow-lg">
                                 <Plus size={14} />
                              </div>
                           </div>
                        </div>
                      ))}
                   </div>
                </div>

                {/* Right Side: Cart Summary */}
                <div className="flex-[2] bg-slate-50 p-8 flex flex-col border-l border-slate-100">
                   <div className="mb-6">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 block">Identitas Pelanggan</label>
                      <div className="relative">
                         <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                         <input 
                           type="text" 
                           placeholder="Nama Pelanggan / No. Telp"
                           value={manualCustomerName}
                           onChange={(e) => setManualCustomerName(e.target.value)}
                           className="w-full bg-white border border-slate-200 rounded-2xl pl-12 pr-4 py-4 text-xs font-black text-slate-900 focus:outline-none focus:border-indigo-600 transition-all"
                         />
                      </div>
                   </div>

                   <div className="flex-1 overflow-y-auto space-y-4 mb-6">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                         <span className="text-[10px] font-black text-slate-400 uppercase">Keranjang Pesanan</span>
                         <span className="text-[10px] font-black text-slate-400">{selectedItems.length} Item</span>
                      </div>

                      {selectedItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center opacity-40">
                           <ShoppingBag size={48} className="text-slate-300 mb-4" />
                           <p className="text-[10px] font-black uppercase tracking-widest">Pilih menu di sisi kiri</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                           {selectedItems.map((cartItem) => {
                             const menu = menuItems.find(m => m.id === cartItem.id);
                             if (!menu) return null;
                             return (
                               <div key={cartItem.id} className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
                                  <div className="flex-1">
                                     <h5 className="text-[11px] font-black text-slate-900 leading-tight">{menu.name}</h5>
                                     <span className="text-[10px] font-bold text-indigo-600">Rp {(menu.price * cartItem.quantity).toLocaleString()}</span>
                                  </div>
                                  <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-100">
                                     <button 
                                      onClick={(e) => { e.stopPropagation(); removeFromManualOrder(menu.id); }}
                                      className="p-1 text-slate-400 hover:text-rose-500 hover:bg-white rounded-lg transition-all"
                                     >
                                        <Minus size={12} />
                                     </button>
                                     <span className="text-[11px] font-black text-slate-900 min-w-[20px] text-center">{cartItem.quantity}</span>
                                     <button 
                                      onClick={(e) => { e.stopPropagation(); addToManualOrder(menu.id); }}
                                      className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-all"
                                     >
                                        <Plus size={12} />
                                     </button>
                                  </div>
                               </div>
                             );
                           })}
                        </div>
                      )}
                   </div>

                   <div className="space-y-4 pt-6 border-t-2 border-dashed border-slate-200">
                      <div className="flex justify-between items-center">
                         <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Total Bayar:</span>
                         <span className="text-2xl font-black text-slate-900">Rp {manualOrderTotal.toLocaleString()}</span>
                      </div>

                      <button 
                        disabled={!manualCustomerName || selectedItems.length === 0 || manualSubmitting}
                        onClick={submitManualOrder}
                        className="w-full py-5 bg-slate-900 text-white rounded-[1.5rem] text-sm font-black uppercase tracking-[0.2em] hover:bg-black transition-all shadow-xl shadow-slate-200 flex items-center justify-center gap-3 disabled:opacity-50"
                      >
                         {manualSubmitting ? (
                           <RefreshCw size={20} className="animate-spin" />
                         ) : (
                           <>Simpan & Lanjutkan <Check size={20}/></>
                         )}
                      </button>
                   </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isCashModalOpen && cashOrder && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl relative"
            >
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <ArrowUpDown size={32} />
                </div>
                <h3 className="text-xl font-black text-slate-900">Pembayaran Tunai</h3>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Invoice: {cashOrder.invoice_number}</p>
              </div>

              <div className="space-y-6">
                <div>
                   <div className="flex justify-between items-center mb-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Tagihan</label>
                   </div>
                   <div className="bg-slate-50 rounded-2xl p-4 text-center">
                     <span className="text-2xl font-black text-slate-900">Rp {cashOrder.total_price.toLocaleString()}</span>
                   </div>
                </div>

                <div>
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Jumlah Uang Diterima</label>
                   <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-indigo-600">Rp</span>
                      <input 
                        type="number" 
                        autoFocus
                        value={cashAmount}
                        onChange={(e) => setCashAmount(e.target.value)}
                        placeholder="0"
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-12 pr-4 py-4 text-xl font-black text-slate-900 focus:outline-none focus:border-indigo-600 transition-all"
                      />
                   </div>
                </div>

                {parseFloat(cashAmount) >= cashOrder.total_price && (
                   <motion.div 
                     initial={{ opacity: 0, y: 10 }}
                     animate={{ opacity: 1, y: 0 }}
                     className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100"
                   >
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Uang Kembalian</span>
                        <span className="text-xl font-black text-emerald-700">Rp {changeValue.toLocaleString()}</span>
                      </div>
                   </motion.div>
                )}

                <div className="pt-4 flex gap-3">
                   <button 
                     onClick={() => setIsCashModalOpen(false)}
                     className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-all font-mono"
                   >
                      Batal
                   </button>
                   <button 
                     disabled={!cashAmount || parseFloat(cashAmount) < cashOrder.total_price}
                     onClick={() => verifyPayment(cashOrder.id, { method: 'Tunai', amount: parseFloat(cashAmount) })}
                     className="flex-[2] py-4 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-black transition-all shadow-lg shadow-slate-200 disabled:opacity-50"
                   >
                      Konfirmasi Bayar
                   </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Status: {selectedOrder.payment_status.replace('_', ' ')}</p>
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
                    <span className="text-lg font-black text-slate-900">Rp {selectedOrder.total_price.toLocaleString()}</span>
                 </div>

                 {/* Bukti Bayar Image Preview */}
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
                {selectedOrder.payment_status === 'pending_verifikasi' ? (
                  <div className="flex gap-2">
                    <button 
                      onClick={() => verifyPayment(selectedOrder.id)}
                      className="flex-1 bg-emerald-600 text-white py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
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
                    Sudah Terverifikasi
                  </button>
                )}
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
