import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Archive, CheckCircle2, Coffee, Image as ImageIcon, Package, Pencil, Plus, RefreshCw, Search, UtensilsCrossed, X } from 'lucide-react';
import { authFetch } from '../lib/authFetch';

type Outlet = 'ngolab' | 'coworking';
type MenuItem = {
  id: string; name: string; category: string; price: number; stock: number; image: string; description: string;
  outlet: Outlet; isActive: boolean; inStock: boolean; inventoryAvailable: boolean; availabilityOverride: 'auto' | 'force_off';
};
const categories: Record<Outlet, string[]> = {
  ngolab: ['Main Course', 'Beverage', 'Snack'],
  coworking: ['Ready Meal', 'Makanan Ringan', 'Es Krim', 'Minuman Siap Saji']
};
const emptyForm = (outlet: Outlet) => ({ name: '', category: categories[outlet][0], price: 0, stock: 0, image: '', description: '', outlet });

export default function MenuManagement({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const [outlet, setOutlet] = useState<Outlet>('ngolab');
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [modal, setModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(emptyForm('ngolab'));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await authFetch(`/api/menu?outlet=${outlet}&source=local&includeArchived=1`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Gagal mengambil menu.');
      setItems(Array.isArray(data) ? data : []);
    } catch (requestError: any) { setError(requestError.message); }
    finally { setLoading(false); }
  }, [outlet]);
  useEffect(() => { setForm(emptyForm(outlet)); setEditingId(null); setModal(false); load(); }, [outlet, load]);

  const request = async (url: string, init: RequestInit) => {
    const response = await authFetch(url, init); const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || 'Permintaan gagal.'); return data;
  };
  const openNew = () => { setEditingId(null); setForm(emptyForm(outlet)); setModal(true); };
  const openEdit = (item: MenuItem) => { setEditingId(item.id); setForm({ ...item }); setModal(true); };
  const fileSelected = (file?: File) => {
    if (!file) return; if (file.size > 5 * 1024 * 1024) { setError('Ukuran gambar maksimal 5 MB.'); return; }
    const reader = new FileReader(); reader.onload = () => setForm((current: any) => ({ ...current, image: reader.result as string })); reader.readAsDataURL(file);
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true); setError(''); setMessage('');
    try {
      await request(editingId ? `/api/menu/${editingId}` : '/api/menu', {
        method: editingId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, outlet })
      });
      setModal(false); setMessage(editingId ? 'Menu berhasil diperbarui.' : 'Menu berhasil ditambahkan.'); await load();
    } catch (requestError: any) { setError(requestError.message); }
    finally { setSaving(false); }
  };
  const setArchived = async (item: MenuItem, isActive: boolean) => {
    setError(''); setMessage('');
    try {
      const data = await request(`/api/menu/${item.id}/archive`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive }) });
      setItems(current => current.map(menu => menu.id === item.id ? data.item : menu)); setMessage(data.message);
    } catch (requestError: any) { setError(requestError.message); }
  };

  const filtered = useMemo(() => items.filter(item => (showArchived || item.isActive) && `${item.name} ${item.category}`.toLowerCase().includes(search.toLowerCase())), [items, showArchived, search]);
  const activeCount = items.filter(item => item.isActive).length;
  const archivedCount = items.length - activeCount;

  return <div className="space-y-6 pb-20">
    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4"><div><div className="flex items-center gap-3"><div className="p-2.5 rounded-xl bg-violet-50 text-violet-600"><UtensilsCrossed/></div><h2 className="text-2xl font-bold dark:text-white">Manajemen Menu</h2></div><p className="text-sm text-slate-500 ml-12 mt-1">Master menu terpusat untuk Ngolab dan Coworking. Stok dikelola melalui Inventori.</p></div><div className="flex gap-2"><button onClick={() => onNavigate?.('menu-availability')} className="px-4 py-2.5 rounded-xl bg-emerald-50 text-emerald-700 font-bold text-sm">Ketersediaan Menu</button><button onClick={openNew} className="px-4 py-2.5 rounded-xl bg-violet-600 text-white font-bold text-sm flex gap-2"><Plus size={17}/> Tambah Menu</button></div></div>
    {(message || error) && <div className={`p-4 rounded-xl border ${error ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>{error || message}</div>}
    <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-900 rounded-2xl w-fit">{(['ngolab','coworking'] as Outlet[]).map(value => <button key={value} onClick={() => setOutlet(value)} className={`px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 ${outlet === value ? 'bg-white dark:bg-slate-800 text-violet-600 shadow-sm' : 'text-slate-500'}`}>{value === 'ngolab' ? <Package size={16}/> : <Coffee size={16}/>} {value === 'ngolab' ? 'Ngolab' : 'Coworking'}</button>)}</div>
    <div className="grid grid-cols-3 gap-3">{[['Total',items.length,'bg-violet-50 text-violet-700'],['Aktif',activeCount,'bg-emerald-50 text-emerald-700'],['Diarsipkan',archivedCount,'bg-slate-100 text-slate-600']].map(([label,value,color]) => <div key={String(label)} className={`p-4 rounded-2xl ${color}`}><p className="text-xs font-bold uppercase opacity-70">{label}</p><p className="text-3xl font-black">{value}</p></div>)}</div>
    <div className="flex flex-col md:flex-row gap-3"><div className="relative flex-1"><Search className="absolute left-4 top-3.5 text-slate-400" size={18}/><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Cari nama atau kategori menu..." className="w-full pl-11 pr-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 dark:text-white"/></div><label className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border dark:border-slate-800 text-sm dark:text-white"><input type="checkbox" checked={showArchived} onChange={event=>setShowArchived(event.target.checked)}/> Tampilkan arsip</label><button onClick={load} className="px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border dark:border-slate-800"><RefreshCw size={18}/></button></div>
    {loading ? <p className="text-center py-16 text-slate-500">Memuat menu...</p> : <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">{filtered.map(item => <div key={item.id} className={`bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-800 overflow-hidden ${!item.isActive ? 'opacity-60' : ''}`}><div className="h-40 bg-slate-100 dark:bg-slate-800">{item.image && <img src={item.image} alt={item.name} className="w-full h-full object-cover"/>}</div><div className="p-5"><div className="flex justify-between gap-3"><div><span className="text-xs text-slate-500">{item.category}</span><h3 className="font-bold text-lg dark:text-white mt-1">{item.name}</h3><p className="font-black text-violet-600 mt-1">Rp {Number(item.price).toLocaleString('id-ID')}</p></div><span className={`self-start px-2 py-1 rounded-full text-[10px] font-bold ${item.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>{item.isActive ? 'AKTIF' : 'ARSIP'}</span></div><p className="text-xs text-slate-500 mt-3 line-clamp-2 min-h-8">{item.description || 'Belum ada deskripsi.'}</p><div className="flex gap-2 mt-4"><button onClick={() => openEdit(item)} className="flex-1 py-2.5 rounded-xl bg-violet-50 text-violet-700 font-bold text-sm flex justify-center gap-2"><Pencil size={15}/> Edit</button>{item.isActive ? <button onClick={() => setArchived(item,false)} className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold text-sm flex justify-center gap-2"><Archive size={15}/> Arsipkan</button> : <button onClick={() => setArchived(item,true)} className="flex-1 py-2.5 rounded-xl bg-emerald-50 text-emerald-700 font-bold text-sm flex justify-center gap-2"><CheckCircle2 size={15}/> Pulihkan</button>}</div></div></div>)}</div>}

    {modal && <div className="fixed inset-0 z-50 flex items-center justify-center p-4"><div className="absolute inset-0 bg-slate-950/60" onClick={()=>setModal(false)}/><form onSubmit={save} className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-2xl p-6"><div className="flex justify-between"><div><h3 className="text-xl font-bold dark:text-white">{editingId ? 'Edit' : 'Tambah'} Menu {outlet === 'ngolab' ? 'Ngolab' : 'Coworking'}</h3><p className="text-xs text-slate-500">Ketersediaan dan stok diatur di halaman terpisah.</p></div><button type="button" onClick={()=>setModal(false)}><X/></button></div><div className="grid md:grid-cols-2 gap-4 mt-5"><label className="text-xs font-bold text-slate-500 md:col-span-2">NAMA MENU<input required value={form.name} onChange={event=>setForm({...form,name:event.target.value})} className="menu-field"/></label><label className="text-xs font-bold text-slate-500">KATEGORI<select value={form.category} onChange={event=>setForm({...form,category:event.target.value})} className="menu-field">{categories[outlet].map(category=><option key={category}>{category}</option>)}</select></label><label className="text-xs font-bold text-slate-500">HARGA<input required type="number" min="1" value={form.price} onChange={event=>setForm({...form,price:Number(event.target.value)})} className="menu-field"/></label>{!editingId && <label className="text-xs font-bold text-slate-500">STOK AWAL MENU TANPA RESEP<input type="number" min="0" value={form.stock} onChange={event=>setForm({...form,stock:Number(event.target.value)})} className="menu-field"/></label>}<label className="text-xs font-bold text-slate-500 md:col-span-2">DESKRIPSI<textarea value={form.description} onChange={event=>setForm({...form,description:event.target.value})} className="menu-field" rows={3}/></label><label className="md:col-span-2 border-2 border-dashed dark:border-slate-700 rounded-xl p-5 text-center cursor-pointer"><ImageIcon className="mx-auto text-slate-400"/><span className="text-sm text-slate-500 block mt-2">Pilih foto menu, maksimal 5 MB</span><input type="file" accept="image/*" className="hidden" onChange={event=>fileSelected(event.target.files?.[0])}/></label>{form.image && <img src={form.image} alt="Preview" className="md:col-span-2 h-48 w-full object-cover rounded-xl"/>}</div><button disabled={saving} className="mt-5 w-full py-3 rounded-xl bg-violet-600 text-white font-bold">{saving ? 'Menyimpan...' : 'Simpan Menu'}</button></form></div>}
    <style>{`.menu-field{display:block;width:100%;margin-top:.4rem;padding:.75rem 1rem;border:1px solid rgb(226 232 240);border-radius:.75rem;background:rgb(248 250 252);color:rgb(15 23 42)}.dark .menu-field{background:rgb(2 6 23);border-color:rgb(51 65 85);color:white}`}</style>
  </div>;
}
