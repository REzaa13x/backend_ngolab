import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarCheck, CheckCircle2, Clock3, Coffee, Package, Search, UserRound, WalletCards, XCircle } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { authFetch } from '../lib/authFetch';


type OutletFilter = 'all' | 'ngolab' | 'coworking';
type StatusFilter = 'all' | 'reserved' | 'picked_up' | 'no_show' | 'cancelled' | 'unpaid';

interface PreorderOrder {
  id: string;
  invoice_number: string;
  customer_name: string;
  campaign_name: string;
  outlet: 'ngolab' | 'coworking';
  total_price: number;
  payment_status: string;
  payment_method?: string;
  payment_timing: 'before_pickup' | 'on_pickup';
  preorder_status: 'reserved' | 'picked_up' | 'no_show' | 'cancelled';
  fulfillment_at: string;
  order_deadline_at: string;
  created_at: string;
  can_cancel: boolean;
  can_pick_up: boolean;
  can_no_show: boolean;
  items: Array<{ name: string; quantity: number; price: number }>;
}

const formatDate = (value: string) => new Date(value).toLocaleString('id-ID', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
});

const operationLabel: Record<string, string> = {
  reserved: 'Menunggu Pengambilan', picked_up: 'Sudah Diambil', no_show: 'No-show', cancelled: 'Dibatalkan'
};

const operationClass: Record<string, string> = {
  reserved: 'bg-blue-50 text-blue-700', picked_up: 'bg-emerald-50 text-emerald-700',
  no_show: 'bg-slate-100 text-slate-600', cancelled: 'bg-rose-50 text-rose-700'
};

export default function PreorderOrders() {

  const [orders, setOrders] = useState<PreorderOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [outlet, setOutlet] = useState<OutletFilter>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  const fetchOrders = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams();
      if (outlet !== 'all') params.set('outlet', outlet);
      if (status === 'unpaid') params.set('payment_status', 'belum_bayar');
      else if (status !== 'all') params.set('preorder_status', status);
      const response = await authFetch(`/api/preorders/orders?${params}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Gagal mengambil pesanan PO');
      setOrders(Array.isArray(data) ? data : []);
    } catch (cause: any) { setError(cause.message); setOrders([]); }
    finally { setLoading(false); }
  }, [outlet, status]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const filtered = useMemo(() => {
    const needle = search.toLowerCase();
    return orders.filter(order =>
      order.invoice_number.toLowerCase().includes(needle)
      || order.customer_name.toLowerCase().includes(needle)
      || order.campaign_name.toLowerCase().includes(needle)
    );
  }, [orders, search]);

  const stats = useMemo(() => ({
    total: orders.length,
    unpaid: orders.filter(order => order.payment_status !== 'lunas' && order.preorder_status === 'reserved').length,
    ready: orders.filter(order => order.preorder_status === 'reserved').length,
    picked: orders.filter(order => order.preorder_status === 'picked_up').length
  }), [orders]);

  const perform = async (order: PreorderOrder, action: 'pay' | 'pickup' | 'no-show' | 'cancel') => {
    const labels = { pay: 'menandai lunas', pickup: 'menandai sudah diambil', 'no-show': 'menandai no-show', cancel: 'membatalkan PO' };
    if (!confirm(`Yakin ingin ${labels[action]} untuk ${order.invoice_number}?`)) return;
    setBusyId(order.id); setError('');
    try {
      const response = await authFetch(`/api/preorders/orders/${order.id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: action === 'pay' ? JSON.stringify({ payment_method: order.payment_method || 'Tunai' }) : undefined
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Aksi gagal');
      await fetchOrders();
    } catch (cause: any) { setError(cause.message); }
    finally { setBusyId(''); }
  };

  return (
    <div className="space-y-6 pb-16">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><CalendarCheck size={20}/></div><div><h2 className="text-2xl font-bold text-slate-900">Pesanan Pre-order</h2><p className="text-sm text-slate-500">Pusat pembayaran, pengambilan, pembatalan, dan no-show PO.</p></div></div></div>
        <button onClick={fetchOrders} className="h-10 px-4 border border-slate-200 bg-white rounded-lg text-xs font-semibold text-slate-600">Muat Ulang</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total PO', value: stats.total, icon: CalendarCheck, color: 'text-primary bg-primary/10' },
          { label: 'Belum Lunas', value: stats.unpaid, icon: WalletCards, color: 'text-amber-700 bg-amber-50' },
          { label: 'Menunggu Diambil', value: stats.ready, icon: Clock3, color: 'text-blue-700 bg-blue-50' },
          { label: 'Sudah Diambil', value: stats.picked, icon: CheckCircle2, color: 'text-emerald-700 bg-emerald-50' }
        ].map(card => <div key={card.label} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3"><div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', card.color)}><card.icon size={18}/></div><div><p className="text-xl font-bold text-slate-900">{card.value}</p><p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">{card.label}</p></div></div>)}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col xl:flex-row gap-3">
        <div className="flex p-1 bg-slate-100 rounded-lg">
          {(['all', 'ngolab', 'coworking'] as OutletFilter[]).map(value => <button key={value} onClick={() => setOutlet(value)} className={cn('px-3 py-2 rounded-md text-xs font-bold flex items-center gap-1.5', outlet === value ? 'bg-white text-primary shadow-sm' : 'text-slate-500')}>{value === 'ngolab' && <Package size={13}/>} {value === 'coworking' && <Coffee size={13}/>} {value === 'all' ? 'Semua Outlet' : value === 'ngolab' ? 'Ngolab' : 'Coworking'}</button>)}
        </div>
        <select value={status} onChange={event => setStatus(event.target.value as StatusFilter)} className="h-10 border border-slate-200 rounded-lg px-3 text-xs bg-white"><option value="all">Semua Status</option><option value="reserved">Menunggu Pengambilan</option><option value="unpaid">Belum Lunas</option><option value="picked_up">Sudah Diambil</option><option value="no_show">No-show</option><option value="cancelled">Dibatalkan</option></select>
        <div className="relative flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Cari invoice, pelanggan, atau program PO..." className="w-full h-10 border border-slate-200 rounded-lg pl-9 pr-3 text-sm"/></div>
      </div>

      {error && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-sm">{error}</div>}

      {loading ? <div className="py-20 text-center text-sm text-slate-400">Memuat pesanan PO...</div> : filtered.length === 0 ? (
        <div className="py-20 bg-white border border-dashed border-slate-300 rounded-xl text-center"><CalendarCheck size={38} className="mx-auto text-slate-300 mb-3"/><p className="font-semibold text-slate-700">Belum ada pesanan PO</p><p className="text-sm text-slate-400">Pesanan yang sesuai filter akan muncul di sini.</p></div>
      ) : (
        <div className="space-y-4">
          {filtered.map(order => {
            const inactive = ['picked_up', 'no_show', 'cancelled'].includes(order.preorder_status);
            return <article key={order.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="p-5 border-b border-slate-100 flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                <div className="flex gap-3"><div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500"><UserRound size={18}/></div><div><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs font-bold text-primary">{order.invoice_number}</span><span className="px-2 py-0.5 rounded bg-slate-100 text-[9px] font-bold uppercase">{order.outlet}</span><span className={cn('px-2 py-0.5 rounded text-[9px] font-bold', operationClass[order.preorder_status] || operationClass.reserved)}>{operationLabel[order.preorder_status] || 'Menunggu'}</span>{order.payment_status === 'lunas' ? <span className="px-2 py-0.5 rounded bg-emerald-50 text-[9px] font-bold text-emerald-700">LUNAS</span> : <span className="px-2 py-0.5 rounded bg-amber-50 text-[9px] font-bold text-amber-700">BELUM LUNAS</span>}</div><h3 className="font-bold text-slate-900 mt-2">{order.customer_name}</h3><p className="text-xs text-slate-500">{order.campaign_name}</p></div></div>
                <div className="lg:text-right"><p className="text-xs text-slate-400">Waktu pengambilan</p><p className="text-sm font-bold text-slate-800">{formatDate(order.fulfillment_at)}</p><p className="text-lg font-bold text-primary mt-1">Rp {Number(order.total_price).toLocaleString()}</p></div>
              </div>
              <div className="p-5 grid lg:grid-cols-[1fr_auto] gap-5">
                <div><p className="text-[10px] font-bold uppercase text-slate-400 mb-2">Rincian Pesanan</p><div className="space-y-2">{order.items.map((item, index) => <div key={index} className="flex justify-between text-sm"><span>{item.quantity}× {item.name}</span><b>Rp {(Number(item.price) * Number(item.quantity)).toLocaleString()}</b></div>)}</div><div className="mt-3 flex flex-wrap gap-2 text-[10px]"><span className="px-2 py-1 bg-slate-50 rounded">{order.payment_timing === 'before_pickup' ? 'Bayar sebelum pengambilan' : 'Bayar saat/setelah pengambilan'}</span><span className="px-2 py-1 bg-slate-50 rounded">Metode: {order.payment_method || 'Belum dipilih'}</span><span className="px-2 py-1 bg-slate-50 rounded">Deadline: {formatDate(order.order_deadline_at)}</span></div></div>
                {!inactive && <div className="flex flex-wrap lg:flex-col justify-end gap-2 min-w-44">
                  {order.payment_status !== 'lunas' && <button disabled={busyId === order.id} onClick={() => perform(order, 'pay')} className="h-9 px-3 rounded-lg bg-emerald-600 text-white text-xs font-bold">Tandai Lunas</button>}
                  {order.can_pick_up && <button disabled={busyId === order.id} onClick={() => perform(order, 'pickup')} className="h-9 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-bold">Sudah Diambil</button>}
                  {order.can_cancel && <button disabled={busyId === order.id} onClick={() => perform(order, 'cancel')} className="h-9 px-3 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-xs font-bold">Batalkan PO</button>}
                  {order.can_no_show && <button disabled={busyId === order.id} onClick={() => perform(order, 'no-show')} className="h-9 px-3 rounded-lg border border-slate-200 text-slate-600 text-xs font-bold flex items-center justify-center gap-1"><XCircle size={13}/> No-show</button>}
                </div>}
              </div>
            </article>;
          })}
        </div>
      )}
    </div>
  );
}
