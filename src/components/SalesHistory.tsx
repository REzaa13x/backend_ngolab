import React, { useState, useEffect, useCallback } from 'react';
import {
  History, RefreshCcw, Search, TrendingUp, ShoppingBag,
  CheckCircle2, XCircle, Clock, AlertCircle, ChevronDown, ChevronUp,
  Wifi, WifiOff, Package, Coffee, ExternalLink, Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/src/lib/utils';

// ── Types ──────────────────────────────────────────────────────────────────
interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

interface Order {
  id: string;
  invoice_number: string;
  customer_name: string;
  total_price: number;
  payment_status: string;
  payment_method: string;
  status: string;
  created_at: string;
  source: 'ngolab' | 'smart_tag' | 'coworking' | string;
  items?: OrderItem[];
}

type FilterSource = 'semua' | 'ngolab' | 'smart_tag';
type FilterStatus = 'semua' | 'lunas' | 'pending_verifikasi' | 'belum_bayar' | 'ditolak';

const SMART_TAG_BASE = 'http://192.168.1.11:5000';

// ── Helpers ────────────────────────────────────────────────────────────────
const statusLabel: Record<string, { label: string; color: string }> = {
  lunas:              { label: 'Lunas',    color: 'text-emerald-700 bg-emerald-50 border-emerald-100' },
  pending_verifikasi: { label: 'Pending',  color: 'text-amber-700 bg-amber-50 border-amber-100' },
  belum_bayar:        { label: 'Belum Bayar', color: 'text-slate-600 bg-slate-100 border-slate-200' },
  ditolak:            { label: 'Ditolak',  color: 'text-rose-700 bg-rose-50 border-rose-100' },
};

const orderStatusLabel: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  menunggu:         { label: 'Menunggu',   icon: Clock,         color: 'text-amber-600' },
  sedang_diproses:  { label: 'Diproses',   icon: RefreshCcw,    color: 'text-indigo-600' },
  siap:             { label: 'Siap',       icon: CheckCircle2,  color: 'text-emerald-600' },
  selesai:          { label: 'Selesai',    icon: CheckCircle2,  color: 'text-slate-500' },
  dibatalkan:       { label: 'Dibatalkan', icon: XCircle,       color: 'text-rose-500' },
};

function fmtRp(n: number) {
  return 'Rp ' + n.toLocaleString('id-ID');
}

function fmtDate(d: string) {
  return new Date(d).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function SalesHistory() {
  const [ourOrders, setOurOrders] = useState<Order[]>([]);
  const [friendOrders, setFriendOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [friendStatus, setFriendStatus] = useState<'loading' | 'online' | 'offline'>('loading');
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState('');
  const [filterSource, setFilterSource] = useState<FilterSource>('semua');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('semua');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ── Fetch our orders ─────────────────────────────────────────────────────
  const fetchOurOrders = async () => {
    try {
      const res = await fetch('/api/orders');
      if (!res.ok) throw new Error('API error');
      const data: Order[] = await res.json();
      setOurOrders(data.map(o => ({ ...o, source: o.source || 'ngolab' })));
    } catch (err) {
      console.error('Failed to fetch our orders:', err);
    }
  };

  // ── Fetch friend's orders (Smart Tag API) ───────────────────────────────
  const fetchFriendOrders = async () => {
    setFriendStatus('loading');
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(`${SMART_TAG_BASE}/api/orders`, {
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error('Not ok');
      const raw: any[] = await res.json();

      // Normalise friend's data structure → our Order shape
      const normalised: Order[] = raw.map((o: any) => ({
        id:               String(o.id || o.order_id || o._id || Math.random()),
        invoice_number:   o.invoice_number || o.invoice || o.order_id || `ST-${o.id}`,
        customer_name:    o.customer_name || o.nama || o.user_name || 'Pelanggan',
        total_price:      parseFloat(o.total_price || o.total || o.amount || 0),
        payment_status:   o.payment_status || (o.status === 'paid' ? 'lunas' : 'belum_bayar'),
        payment_method:   o.payment_method || o.metode_bayar || 'QRIS',
        status:           o.status || o.order_status || 'selesai',
        created_at:       o.created_at || o.createdAt || o.date || new Date().toISOString(),
        source:           'smart_tag',
        items:            (o.items || o.order_items || []).map((i: any) => ({
          name:     i.name || i.item_name || i.menu_name || 'Item',
          quantity: i.quantity || i.qty || 1,
          price:    parseFloat(i.price || i.harga || 0),
        })),
      }));

      setFriendOrders(normalised);
      setFriendStatus('online');
    } catch (err: any) {
      console.warn('Smart Tag offline:', err.message);
      setFriendOrders([]);
      setFriendStatus('offline');
    }
  };

  // ── Combined load ────────────────────────────────────────────────────────
  const loadAll = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);
    await Promise.all([fetchOurOrders(), fetchFriendOrders()]);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Merge + filter ───────────────────────────────────────────────────────
  const allOrders = [...ourOrders, ...friendOrders].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const filtered = allOrders.filter(o => {
    const matchSrc =
      filterSource === 'semua' ? true :
      filterSource === 'smart_tag' ? o.source === 'smart_tag' :
      o.source !== 'smart_tag';
    const matchStatus =
      filterStatus === 'semua' ? true : o.payment_status === filterStatus;
    const matchSearch =
      !search ||
      o.customer_name.toLowerCase().includes(search.toLowerCase()) ||
      o.invoice_number.toLowerCase().includes(search.toLowerCase());
    return matchSrc && matchStatus && matchSearch;
  });

  // ── Stats ────────────────────────────────────────────────────────────────
  const stats = {
    totalRevenue:  allOrders.filter(o => o.payment_status === 'lunas').reduce((s, o) => s + o.total_price, 0),
    ourRevenue:    ourOrders.filter(o => o.payment_status === 'lunas').reduce((s, o) => s + o.total_price, 0),
    friendRevenue: friendOrders.filter(o => o.payment_status === 'lunas').reduce((s, o) => s + o.total_price, 0),
    totalOrders:   allOrders.length,
    ourOrders:     ourOrders.length,
    friendOrders:  friendOrders.length,
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8 pb-12">

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-violet-50 rounded-2xl border border-violet-100">
            <History size={22} className="text-violet-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 leading-tight">History Penjualan</h2>
            <p className="text-sm text-slate-500 font-medium mt-0.5">
              Riwayat transaksi gabungan dari Ngolab &amp; Smart Tag teman.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Friend API status badge */}
          <div className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition-all',
            friendStatus === 'online'  ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
            friendStatus === 'offline' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                                         'bg-amber-50 text-amber-600 border-amber-100'
          )}>
            {friendStatus === 'online'  ? <Wifi size={13} /> :
             friendStatus === 'offline' ? <WifiOff size={13} /> :
                                          <RefreshCcw size={13} className="animate-spin" />}
            Smart Tag {friendStatus === 'online' ? 'Online' : friendStatus === 'offline' ? 'Offline' : 'Connecting...'}
          </div>
          <button
            onClick={() => loadAll(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 text-white rounded-xl text-xs font-bold hover:bg-violet-700 transition-all disabled:opacity-50 shadow-lg shadow-violet-200"
          >
            <RefreshCcw size={14} className={cn(refreshing && 'animate-spin')} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Stats Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">

        {/* Combined Revenue */}
        <div className="lg:col-span-1 bg-gradient-to-br from-violet-600 to-violet-800 rounded-[2rem] p-6 text-white shadow-xl shadow-violet-200 relative overflow-hidden">
          <div className="absolute -top-6 -right-6 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
          <div className="relative z-10">
            <p className="text-[10px] font-black uppercase tracking-widest text-violet-200 mb-2">Total Pendapatan</p>
            <p className="text-3xl font-black leading-tight">{fmtRp(stats.totalRevenue)}</p>
            <p className="text-xs text-violet-200 font-bold mt-2">{stats.totalOrders} transaksi gabungan</p>
          </div>
        </div>

        {/* Ngolab Revenue */}
        <div className="bg-white rounded-[2rem] border border-slate-100 p-6 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 bg-indigo-50 rounded-xl">
              <Package size={16} className="text-indigo-600" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ngolab</p>
              <p className="text-xs font-bold text-slate-500">{stats.ourOrders} transaksi</p>
            </div>
          </div>
          <p className="text-xl font-black text-indigo-600">{fmtRp(stats.ourRevenue)}</p>
        </div>

        {/* Smart Tag Revenue */}
        <div className={cn(
          'bg-white rounded-[2rem] border p-6 shadow-sm hover:shadow-md transition-all',
          friendStatus === 'offline' ? 'border-rose-100 bg-rose-50/30' : 'border-slate-100'
        )}>
          <div className="flex items-center gap-3 mb-3">
            <div className={cn('p-2.5 rounded-xl', friendStatus === 'offline' ? 'bg-rose-50' : 'bg-amber-50')}>
              <Coffee size={16} className={friendStatus === 'offline' ? 'text-rose-500' : 'text-amber-600'} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Smart Tag Teman</p>
              <p className="text-xs font-bold text-slate-500">
                {friendStatus === 'offline' ? 'Tidak terhubung' : `${stats.friendOrders} transaksi`}
              </p>
            </div>
          </div>
          <p className={cn('text-xl font-black', friendStatus === 'offline' ? 'text-rose-400' : 'text-amber-600')}>
            {friendStatus === 'offline' ? '—' : fmtRp(stats.friendRevenue)}
          </p>
        </div>
      </div>

      {/* ── Filters & Search ── */}
      <div className="flex flex-col xl:flex-row items-stretch xl:items-center gap-4">

        {/* Search */}
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Cari nama pelanggan atau nomor invoice..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-white border border-slate-100 rounded-2xl pl-12 pr-4 py-3.5 text-sm focus:outline-none focus:ring-4 focus:ring-violet-500/10 transition-all font-medium"
          />
        </div>

        {/* Source filter */}
        <div className="flex gap-1 p-1 bg-slate-100 rounded-2xl border border-slate-200">
          {(['semua', 'ngolab', 'smart_tag'] as FilterSource[]).map(s => (
            <button
              key={s}
              onClick={() => setFilterSource(s)}
              className={cn(
                'px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap',
                filterSource === s ? 'bg-white text-violet-600 shadow-sm' : 'text-slate-400 hover:text-slate-700'
              )}
            >
              {s === 'semua' ? 'Semua Sumber' : s === 'ngolab' ? '📦 Ngolab' : '☕ Smart Tag'}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <div className="flex gap-1 p-1 bg-white border border-slate-100 rounded-2xl overflow-x-auto scrollbar-hide">
          {(['semua', 'lunas', 'pending_verifikasi', 'belum_bayar', 'ditolak'] as FilterStatus[]).map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={cn(
                'px-3 py-2 rounded-xl text-[10px] font-bold whitespace-nowrap transition-all',
                filterStatus === s ? 'bg-violet-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'
              )}
            >
              {s === 'semua' ? 'Semua Status' :
               s === 'lunas' ? '✅ Lunas' :
               s === 'pending_verifikasi' ? '⏳ Pending' :
               s === 'belum_bayar' ? '⬜ Belum Bayar' : '❌ Ditolak'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Table ── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="animate-spin w-10 h-10 border-4 border-violet-200 border-t-violet-600 rounded-full" />
          <p className="text-sm text-slate-400 font-bold">Memuat riwayat dari semua sumber...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400">
          <History size={48} className="mb-4 opacity-30" />
          <p className="font-bold text-sm">Tidak ada transaksi ditemukan</p>
          <p className="text-xs mt-1">Coba ubah filter atau kata kunci pencarian.</p>
        </div>
      ) : (
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Invoice</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Sumber</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Pelanggan</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Total</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Pembayaran</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Status Order</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Waktu</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((order, idx) => {
                  const isExpanded = expandedId === order.id;
                  const payInfo = statusLabel[order.payment_status] || statusLabel['belum_bayar'];
                  const ordInfo = orderStatusLabel[order.status] || orderStatusLabel['selesai'];
                  const OrdIcon = ordInfo.icon;
                  const isFriend = order.source === 'smart_tag';

                  return (
                    <React.Fragment key={order.id}>
                      <motion.tr
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(idx * 0.02, 0.3) }}
                        className={cn(
                          'transition-colors cursor-pointer group',
                          isExpanded ? 'bg-violet-50/60' : 'hover:bg-slate-50/60'
                        )}
                        onClick={() => setExpandedId(isExpanded ? null : order.id)}
                      >
                        {/* Invoice */}
                        <td className="px-6 py-4">
                          <p className="text-xs font-black text-slate-900 font-mono">{order.invoice_number}</p>
                          <p className="text-[10px] text-slate-400 font-medium mt-0.5">#{order.id.slice(-6)}</p>
                        </td>

                        {/* Sumber */}
                        <td className="px-6 py-4">
                          <div className={cn(
                            'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border',
                            isFriend
                              ? 'bg-amber-50 text-amber-700 border-amber-100'
                              : 'bg-indigo-50 text-indigo-700 border-indigo-100'
                          )}>
                            {isFriend ? <Coffee size={10} /> : <Package size={10} />}
                            {isFriend ? 'Smart Tag' : 'Ngolab'}
                          </div>
                        </td>

                        {/* Pelanggan */}
                        <td className="px-6 py-4">
                          <p className="text-sm font-bold text-slate-900 capitalize">{order.customer_name}</p>
                          <p className="text-[10px] text-slate-400 font-medium">{order.payment_method}</p>
                        </td>

                        {/* Total */}
                        <td className="px-6 py-4">
                          <p className={cn(
                            'text-sm font-black whitespace-nowrap',
                            isFriend ? 'text-amber-700' : 'text-indigo-700'
                          )}>
                            {fmtRp(order.total_price)}
                          </p>
                        </td>

                        {/* Pembayaran status */}
                        <td className="px-6 py-4 text-center">
                          <span className={cn(
                            'inline-block px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest border',
                            payInfo.color
                          )}>
                            {payInfo.label}
                          </span>
                        </td>

                        {/* Order status */}
                        <td className="px-6 py-4 text-center">
                          <div className={cn('inline-flex items-center gap-1.5 text-[10px] font-bold', ordInfo.color)}>
                            <OrdIcon size={12} />
                            {ordInfo.label}
                          </div>
                        </td>

                        {/* Waktu */}
                        <td className="px-6 py-4">
                          <p className="text-[11px] font-bold text-slate-700 whitespace-nowrap">{fmtDate(order.created_at)}</p>
                        </td>

                        {/* Toggle detail */}
                        <td className="px-6 py-4 text-center">
                          <button className="p-1.5 rounded-lg bg-slate-100 text-slate-400 hover:bg-violet-100 hover:text-violet-600 transition-all">
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        </td>
                      </motion.tr>

                      {/* ── Expanded row: item detail ── */}
                      <AnimatePresence>
                        {isExpanded && (
                          <tr>
                            <td colSpan={8} className="p-0 border-0">
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                              >
                                <div className={cn(
                                  'px-8 py-5 border-b border-slate-100',
                                  isFriend ? 'bg-amber-50/30' : 'bg-indigo-50/30'
                                )}>
                                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">
                                    Rincian Item Pesanan
                                  </p>
                                  {order.items && order.items.length > 0 ? (
                                    <div className="space-y-2">
                                      {order.items.map((item, i) => (
                                        <div key={i} className="flex items-center justify-between py-1.5 px-4 bg-white/80 rounded-xl border border-white shadow-sm">
                                          <div className="flex items-center gap-3">
                                            <span className={cn(
                                              'w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black',
                                              isFriend ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'
                                            )}>
                                              {item.quantity}x
                                            </span>
                                            <p className="text-xs font-bold text-slate-800">{item.name}</p>
                                          </div>
                                          <p className={cn(
                                            'text-xs font-black',
                                            isFriend ? 'text-amber-700' : 'text-indigo-700'
                                          )}>
                                            {fmtRp(item.price * item.quantity)}
                                          </p>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-xs text-slate-400 italic">Detail item tidak tersedia</p>
                                  )}

                                  <div className={cn(
                                    'mt-3 pt-3 border-t flex items-center justify-between',
                                    isFriend ? 'border-amber-100' : 'border-indigo-100'
                                  )}>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Grand Total</p>
                                    <p className={cn(
                                      'text-sm font-black',
                                      isFriend ? 'text-amber-700' : 'text-indigo-700'
                                    )}>
                                      {fmtRp(order.total_price)}
                                    </p>
                                  </div>
                                </div>
                              </motion.div>
                            </td>
                          </tr>
                        )}
                      </AnimatePresence>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table footer */}
          <div className="px-6 py-4 border-t border-slate-50 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Menampilkan <span className="text-slate-700">{filtered.length}</span> dari{' '}
              <span className="text-slate-700">{allOrders.length}</span> transaksi
            </p>
            <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest">
              <span className="text-emerald-600">
                ● {filtered.filter(o => o.payment_status === 'lunas').length} Lunas
              </span>
              <span className="text-amber-600">
                ● {filtered.filter(o => o.payment_status === 'pending_verifikasi').length} Pending
              </span>
              <span className="text-rose-500">
                ● {filtered.filter(o => o.payment_status === 'ditolak').length} Ditolak
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
