import React, { useCallback, useEffect, useState } from 'react';
import { CalendarClock, Plus, Power, Trash2, X, Package, Coffee } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useAuth } from '../contexts/AuthContext';

type Outlet = 'ngolab' | 'coworking';

interface PreorderItem {
  id: string;
  name: string;
  category: string;
  price: number;
  quota_total: number;
  quota_sold: number;
  remaining_quota: number;
  image_url?: string;
}

interface Campaign {
  id: string;
  name: string;
  description?: string;
  outlet: Outlet;
  order_start_at: string;
  order_deadline_at: string;
  service_at: string;
  is_active: boolean;
  status: 'draft' | 'upcoming' | 'open' | 'closed' | 'service_day';
  items: PreorderItem[];
}

const emptyItem = () => ({ name: '', category: 'PO', price: '', quota_total: '', image_url: '', description: '' });
const emptyForm = (outlet: Outlet) => ({
  name: '', description: '', outlet,
  order_start_at: '', order_deadline_at: '', service_at: '',
  items: [emptyItem()]
});

const statusLabel: Record<Campaign['status'], string> = {
  draft: 'Nonaktif', upcoming: 'Akan Datang', open: 'PO Dibuka', closed: 'Ditutup', service_day: 'Hari Penyajian'
};

const statusClass: Record<Campaign['status'], string> = {
  draft: 'bg-slate-100 text-slate-600', upcoming: 'bg-blue-50 text-blue-700', open: 'bg-emerald-50 text-emerald-700',
  closed: 'bg-amber-50 text-amber-700', service_day: 'bg-violet-50 text-violet-700'
};

const formatDate = (value: string) => new Date(value).toLocaleString('id-ID', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
});

export default function PreorderManagement() {
  const { user } = useAuth();
  const [outlet, setOutlet] = useState<Outlet>('ngolab');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm('ngolab'));

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/preorders/admin?outlet=${outlet}`);
      const data = await response.json();
      setCampaigns(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, [outlet]);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);
  useEffect(() => { setForm(emptyForm(outlet)); }, [outlet]);

  const updateItem = (index: number, field: string, value: string) => {
    setForm(current => ({ ...current, items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item) }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true); setError('');
    try {
      const response = await fetch('/api/preorders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-name': user?.name || 'Admin' },
        body: JSON.stringify(form)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Gagal membuat program PO');
      setShowForm(false); setForm(emptyForm(outlet)); await fetchCampaigns();
    } catch (cause: any) { setError(cause.message); }
    finally { setSaving(false); }
  };

  const toggle = async (campaign: Campaign) => {
    await fetch(`/api/preorders/${campaign.id}/toggle`, { method: 'PATCH', headers: { 'x-user-name': user?.name || 'Admin' } });
    fetchCampaigns();
  };

  const remove = async (campaign: Campaign) => {
    if (!confirm(`Hapus program PO “${campaign.name}”?`)) return;
    const response = await fetch(`/api/preorders/${campaign.id}`, { method: 'DELETE' });
    const data = await response.json();
    if (!response.ok) alert(data.message || 'Program tidak dapat dihapus');
    else fetchCampaigns();
  };

  return (
    <div className="space-y-6 pb-16">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><CalendarClock size={20} /></div>
            <div><h2 className="text-2xl font-bold text-slate-900">Menu Pre-order</h2><p className="text-sm text-slate-500">Kelola PO berdasarkan outlet, periode, tanggal penyajian, dan kuota.</p></div>
          </div>
        </div>
        <button onClick={() => { setError(''); setShowForm(true); }} className="h-11 px-5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center gap-2 hover:opacity-90">
          <Plus size={17} /> Buat Program PO
        </button>
      </div>

      <div className="inline-flex p-1 bg-slate-100 border border-slate-200 rounded-xl">
        {(['ngolab', 'coworking'] as Outlet[]).map(value => (
          <button key={value} onClick={() => setOutlet(value)} className={cn('px-5 py-2.5 rounded-lg text-xs font-bold flex items-center gap-2', outlet === value ? 'bg-white text-primary shadow-sm' : 'text-slate-500')}>
            {value === 'ngolab' ? <Package size={15} /> : <Coffee size={15} />} PO {value === 'ngolab' ? 'Ngolab' : 'Coworking'}
          </button>
        ))}
      </div>

      {loading ? <div className="py-20 text-center text-sm text-slate-400">Memuat program PO...</div> : campaigns.length === 0 ? (
        <div className="py-20 bg-white border border-dashed border-slate-300 rounded-2xl text-center">
          <CalendarClock size={40} className="mx-auto text-slate-300 mb-3" /><p className="font-semibold text-slate-700">Belum ada PO {outlet === 'ngolab' ? 'Ngolab' : 'Coworking'}</p><p className="text-sm text-slate-400 mt-1">Buat program pertama untuk outlet ini.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {campaigns.map(campaign => {
            const sold = campaign.items.reduce((sum, item) => sum + Number(item.quota_sold), 0);
            const quota = campaign.items.reduce((sum, item) => sum + Number(item.quota_total), 0);
            return (
              <article key={campaign.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-4">
                  <div><div className="flex items-center gap-2 mb-2"><span className={cn('px-2.5 py-1 rounded-full text-[10px] font-bold uppercase', statusClass[campaign.status])}>{statusLabel[campaign.status]}</span><span className="text-[10px] font-bold uppercase text-slate-400">{campaign.outlet}</span></div><h3 className="font-bold text-lg text-slate-900">{campaign.name}</h3><p className="text-sm text-slate-500 mt-1">{campaign.description || 'Tanpa deskripsi'}</p></div>
                  <div className="flex gap-1"><button title="Aktif/nonaktif" onClick={() => toggle(campaign)} className={cn('w-9 h-9 rounded-lg flex items-center justify-center', campaign.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400')}><Power size={16} /></button><button title="Hapus" onClick={() => remove(campaign)} className="w-9 h-9 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center"><Trash2 size={16} /></button></div>
                </div>
                <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="bg-slate-50 rounded-xl p-3"><span className="text-slate-400 block mb-1">Mulai PO</span><b>{formatDate(campaign.order_start_at)}</b></div>
                  <div className="bg-slate-50 rounded-xl p-3"><span className="text-slate-400 block mb-1">Deadline</span><b>{formatDate(campaign.order_deadline_at)}</b></div>
                  <div className="bg-primary/5 rounded-xl p-3"><span className="text-primary block mb-1">Penyajian</span><b>{formatDate(campaign.service_at)}</b></div>
                </div>
                <div className="px-5 pb-5 space-y-2">
                  {campaign.items.map(item => <div key={item.id} className="flex items-center justify-between p-3 border border-slate-100 rounded-xl"><div><p className="text-sm font-semibold">{item.name}</p><p className="text-xs text-slate-400">Rp {Number(item.price).toLocaleString()} · sisa {item.remaining_quota}</p></div><span className="text-xs font-bold text-primary">{item.quota_sold}/{item.quota_total}</span></div>)}
                  <div className="pt-2 flex justify-between text-xs text-slate-500"><span>{campaign.items.length} menu</span><span>{sold} terjual dari {quota} kuota</span></div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={submit} className="bg-white w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl">
            <div className="sticky top-0 bg-white z-10 px-6 py-4 border-b flex items-center justify-between"><div><h3 className="font-bold text-lg">Program PO {outlet === 'ngolab' ? 'Ngolab' : 'Coworking'}</h3><p className="text-xs text-slate-400">Outlet tidak dapat dicampur dalam satu program.</p></div><button type="button" onClick={() => setShowForm(false)} className="p-2 text-slate-400"><X size={20} /></button></div>
            <div className="p-6 space-y-5">
              {error && <div className="p-3 bg-rose-50 text-rose-700 rounded-lg text-sm">{error}</div>}
              <div className="grid sm:grid-cols-2 gap-4"><label className="sm:col-span-2 text-xs font-semibold text-slate-600">Nama Program<input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="mt-1.5 w-full h-11 border rounded-lg px-3 text-sm" placeholder="Contoh: PO Jumat Berkah" /></label><label className="sm:col-span-2 text-xs font-semibold text-slate-600">Deskripsi<textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="mt-1.5 w-full border rounded-lg p-3 text-sm" /></label><label className="text-xs font-semibold text-slate-600">Mulai PO<input required type="datetime-local" value={form.order_start_at} onChange={e => setForm({ ...form, order_start_at: e.target.value })} className="mt-1.5 w-full h-11 border rounded-lg px-3 text-sm" /></label><label className="text-xs font-semibold text-slate-600">Deadline<input required type="datetime-local" value={form.order_deadline_at} onChange={e => setForm({ ...form, order_deadline_at: e.target.value })} className="mt-1.5 w-full h-11 border rounded-lg px-3 text-sm" /></label><label className="sm:col-span-2 text-xs font-semibold text-slate-600">Tanggal dan Jam Penyajian<input required type="datetime-local" value={form.service_at} onChange={e => setForm({ ...form, service_at: e.target.value })} className="mt-1.5 w-full h-11 border rounded-lg px-3 text-sm" /></label></div>
              <div className="border-t pt-5"><div className="flex justify-between mb-3"><h4 className="font-bold text-sm">Menu dalam Program PO</h4><button type="button" onClick={() => setForm({ ...form, items: [...form.items, emptyItem()] })} className="text-xs font-bold text-primary flex gap-1"><Plus size={14}/> Tambah Menu</button></div><div className="space-y-3">{form.items.map((item, index) => <div key={index} className="grid sm:grid-cols-[1fr_130px_110px_36px] gap-3 bg-slate-50 p-3 rounded-xl"><input required value={item.name} onChange={e => updateItem(index, 'name', e.target.value)} className="h-10 border rounded-lg px-3 text-sm" placeholder="Nama menu"/><input required type="number" min="1" value={item.price} onChange={e => updateItem(index, 'price', e.target.value)} className="h-10 border rounded-lg px-3 text-sm" placeholder="Harga"/><input required type="number" min="1" value={item.quota_total} onChange={e => updateItem(index, 'quota_total', e.target.value)} className="h-10 border rounded-lg px-3 text-sm" placeholder="Kuota"/><button type="button" disabled={form.items.length === 1} onClick={() => setForm({ ...form, items: form.items.filter((_, i) => i !== index) })} className="text-rose-500 disabled:opacity-30"><Trash2 size={16}/></button></div>)}</div></div>
            </div>
            <div className="sticky bottom-0 bg-white px-6 py-4 border-t flex justify-end gap-3"><button type="button" onClick={() => setShowForm(false)} className="px-5 h-10 border rounded-lg text-sm">Batal</button><button disabled={saving} className="px-5 h-10 bg-primary text-primary-foreground rounded-lg text-sm font-semibold disabled:opacity-50">{saving ? 'Menyimpan...' : 'Simpan Program PO'}</button></div>
          </form>
        </div>
      )}
    </div>
  );
}
