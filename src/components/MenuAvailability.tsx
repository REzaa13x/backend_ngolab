import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Coffee, Package, Power, RefreshCw, Search, XCircle } from 'lucide-react';
import { authFetch } from '../lib/authFetch';
import socket from '../lib/socket';

type Outlet = 'ngolab' | 'coworking';
type MenuItem = {
  id: string; name: string; category: string; price: number; stock: number; outlet: Outlet; image: string;
  inStock: boolean; isActive: boolean; inventoryAvailable: boolean; availabilityOverride: 'auto' | 'force_off';
  availabilityReason: string; availabilityUpdatedBy: string; availabilityUpdatedAt: string | null;
  unavailableReason: 'available' | 'manual' | 'inventory' | 'archived';
};

const reasons = ['Persiapan belum selesai', 'Alat dapur bermasalah', 'Bahan tidak layak', 'Menu dihentikan hari ini', 'Permintaan terlalu tinggi', 'Lainnya'];

export default function MenuAvailability({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const [outlet, setOutlet] = useState<Outlet>('ngolab');
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'available' | 'manual' | 'inventory'>('all');
  const [pending, setPending] = useState<MenuItem | null>(null);
  const [reason, setReason] = useState(reasons[0]);
  const [customReason, setCustomReason] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await authFetch(`/api/menu?outlet=${outlet}&source=local`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Gagal mengambil menu.');
      setItems(Array.isArray(data) ? data.filter((item: MenuItem) => item.isActive !== false) : []);
    } catch (requestError: any) { setError(requestError.message); }
    finally { setLoading(false); }
  }, [outlet]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const refresh = () => load();
    socket.on('menu_availability_updated', refresh);
    socket.on('inventory_updated', refresh);
    return () => { socket.off('menu_availability_updated', refresh); socket.off('inventory_updated', refresh); };
  }, [load]);

  const setAvailability = async (item: MenuItem, override: 'auto' | 'force_off', selectedReason = '') => {
    setError(''); setMessage('');
    try {
      const response = await authFetch(`/api/menu/${item.id}/availability`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ override, reason: selectedReason })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Gagal mengubah ketersediaan.');
      setItems(current => current.map(menu => menu.id === item.id ? data.item : menu));
      setMessage(data.message); setPending(null); setCustomReason('');
    } catch (requestError: any) { setError(requestError.message); }
  };

  const filtered = useMemo(() => items.filter(item => {
    const matchSearch = `${item.name} ${item.category}`.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || (filter === 'available' ? item.inStock : item.unavailableReason === filter);
    return matchSearch && matchFilter;
  }), [items, search, filter]);
  const stats = {
    all: items.length,
    available: items.filter(item => item.inStock).length,
    manual: items.filter(item => item.unavailableReason === 'manual').length,
    inventory: items.filter(item => item.unavailableReason === 'inventory').length
  };

  return <div className="space-y-6 pb-20">
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div><h2 className="text-2xl font-bold text-slate-900 dark:text-white">Ketersediaan Menu</h2><p className="text-sm text-slate-500">Nonaktifkan sementara tanpa mengubah stok atau data master menu.</p></div>
      <button onClick={load} className="self-start px-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-2 text-sm font-bold"><RefreshCw size={16}/> Muat Ulang</button>
    </div>

    {(message || error) && <div className={`p-4 rounded-xl border flex gap-2 ${error ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>{error ? <AlertTriangle size={19}/> : <CheckCircle2 size={19}/>} {error || message}</div>}

    <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-900 rounded-2xl w-fit">
      {(['ngolab','coworking'] as Outlet[]).map(value => <button key={value} onClick={() => setOutlet(value)} className={`px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 ${outlet === value ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm' : 'text-slate-500'}`}>{value === 'ngolab' ? <Package size={16}/> : <Coffee size={16}/>} {value === 'ngolab' ? 'Ngolab' : 'Coworking'}</button>)}
    </div>

    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {([
        ['all','Total',stats.all,'bg-indigo-50 text-indigo-700'], ['available','Tersedia',stats.available,'bg-emerald-50 text-emerald-700'],
        ['manual','Nonaktif Manual',stats.manual,'bg-amber-50 text-amber-700'], ['inventory','Stok Habis',stats.inventory,'bg-rose-50 text-rose-700']
      ] as const).map(([id,label,value,color]) => <button key={id} onClick={() => setFilter(id)} className={`rounded-2xl p-4 text-left border-2 ${color} ${filter === id ? 'border-current' : 'border-transparent'}`}><p className="text-xs font-bold uppercase opacity-70">{label}</p><p className="text-3xl font-black mt-1">{value}</p></button>)}
    </div>

    <div className="relative"><Search className="absolute left-4 top-3.5 text-slate-400" size={18}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder={`Cari menu ${outlet === 'ngolab' ? 'Ngolab' : 'Coworking'}...`} className="w-full pl-11 pr-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 dark:text-white"/></div>

    {loading ? <p className="py-12 text-center text-slate-500">Memuat menu...</p> : <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">{filtered.map(item => {
      const status = item.inStock ? { label:'Tersedia', color:'bg-emerald-100 text-emerald-700', detail:`${item.stock} porsi/unit tersedia` }
        : item.unavailableReason === 'manual' ? { label:'Nonaktif Manual', color:'bg-amber-100 text-amber-700', detail:item.availabilityReason || 'Dinonaktifkan petugas' }
        : { label:'Stok Tidak Cukup', color:'bg-rose-100 text-rose-700', detail:'Restock bahan/barang melalui Inventori' };
      return <div key={item.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="h-36 bg-slate-100 dark:bg-slate-800"><img src={item.image} alt={item.name} className={`w-full h-full object-cover ${!item.inStock ? 'grayscale opacity-60' : ''}`} onError={event => { (event.currentTarget as HTMLImageElement).style.display='none'; }}/></div>
        <div className="p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs text-slate-500">{item.category}</p><h3 className="font-bold dark:text-white mt-1">{item.name}</h3></div><span className={`px-2 py-1 rounded-full text-[10px] font-black whitespace-nowrap ${status.color}`}>{status.label}</span></div><p className="text-xs text-slate-500 mt-3 min-h-8">{status.detail}</p>
        {item.unavailableReason === 'manual' && item.availabilityUpdatedBy && <p className="text-[10px] text-slate-400">Oleh {item.availabilityUpdatedBy}{item.availabilityUpdatedAt ? ` · ${new Date(item.availabilityUpdatedAt).toLocaleString('id-ID')}` : ''}</p>}
        <div className="mt-4">{item.availabilityOverride === 'force_off' ? <button onClick={() => setAvailability(item,'auto')} className="w-full py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-sm flex justify-center gap-2"><Power size={16}/> Kembali Otomatis</button> : !item.inventoryAvailable ? <button onClick={() => onNavigate?.('stock')} className="w-full py-2.5 rounded-xl bg-rose-50 text-rose-700 font-bold text-sm">Buka Inventori</button> : <button onClick={() => { setPending(item); setReason(reasons[0]); }} className="w-full py-2.5 rounded-xl bg-amber-50 text-amber-700 font-bold text-sm flex justify-center gap-2"><XCircle size={16}/> Nonaktifkan Sementara</button>}</div></div>
      </div>;
    })}</div>}

    {pending && <div className="fixed inset-0 z-50 flex items-center justify-center p-4"><div className="absolute inset-0 bg-slate-950/60" onClick={() => setPending(null)}/><form onSubmit={event => { event.preventDefault(); setAvailability(pending,'force_off',reason === 'Lainnya' ? customReason : reason); }} className="relative bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-md"><h3 className="text-xl font-bold dark:text-white">Nonaktifkan {pending.name}?</h3><p className="text-sm text-slate-500 mt-2">Menu tetap tersimpan dan dapat diaktifkan kembali tanpa mengubah stok.</p><label className="block text-xs font-bold text-slate-500 mt-5">ALASAN<select value={reason} onChange={event => setReason(event.target.value)} className="mt-2 w-full p-3 rounded-xl border dark:border-slate-700 bg-white dark:bg-slate-950 dark:text-white">{reasons.map(value => <option key={value}>{value}</option>)}</select></label>{reason === 'Lainnya' && <textarea value={customReason} onChange={event => setCustomReason(event.target.value)} required minLength={3} placeholder="Tuliskan alasan..." className="mt-3 w-full p-3 rounded-xl border dark:border-slate-700 bg-white dark:bg-slate-950 dark:text-white"/>}<div className="flex gap-3 mt-5"><button type="button" onClick={() => setPending(null)} className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 font-bold dark:text-white">Batal</button><button className="flex-1 py-3 rounded-xl bg-amber-600 text-white font-bold">Nonaktifkan</button></div></form></div>}
  </div>;
}
