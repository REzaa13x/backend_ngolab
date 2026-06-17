import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Coins, Plus, Trash2, ToggleLeft, ToggleRight, Gift, Users, TrendingUp, Tag, Clock, Percent, X, CheckCircle2, ArrowDown, ArrowUp, Pencil } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/src/lib/utils';

interface CoinPromo {
  id: string; title: string; description: string; coin_cost: number;
  discount_type: 'percentage' | 'fixed' | 'free_item'; discount_value: number;
  free_item_name: string | null; required_item_name: string | null;
  min_order: number; max_usage: number; used_count: number;
  valid_until: string; is_active: boolean; image_url: string;
  category: string; created_at: string;
  product_id?: string | null;
  category_id?: string | null;
}
interface UserRec {
  id: string; nama: string; coin_balance: number;
}
interface Recommendation extends CoinPromo {
  can_redeem: boolean; coins_needed: number; progress: number;
  is_out_of_stock?: boolean;
}
interface CoinTx {
  id: string; user_id: string; user_name: string; type: 'earn'|'redeem';
  amount: number; description: string; promo_id?: string; created_at: string;
}

export default function ProductPromoManagement() {
  const { user } = useAuth();
  const [promos, setPromos] = useState<CoinPromo[]>([]);
  const [users, setUsers] = useState<UserRec[]>([]);
  const [transactions, setTransactions] = useState<CoinTx[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<'all'|'active'|'inactive'>('all');
  const [toast, setToast] = useState('');
  const [form, setForm] = useState({
    title: '',
    description: '',
    coin_cost: '',
    discount_type: 'percentage',
    discount_value: '',
    free_item_name: '',
    required_item_name: '',
    min_order: '0',
    max_usage: '100',
    valid_until: '',
    image_url: '',
    category: 'Semua',
    target_promo: 'Per Produk',
    product_id: null as string | null,
    category_id: null as string | null
  });
  const [selectedFile, setSelectedFile] = useState<File|null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [productsCatalog, setProductsCatalog] = useState<any[]>([]);
  const isTitleAuto = React.useRef(true);
  const [editingPromo, setEditingPromo] = useState<CoinPromo | null>(null);

  const startEdit = (promo: CoinPromo) => {
    setEditingPromo(promo);
    setForm({
      title: promo.title,
      description: promo.description || '',
      coin_cost: promo.coin_cost.toString(),
      discount_type: promo.discount_type,
      discount_value: promo.discount_value.toString(),
      free_item_name: promo.free_item_name || '',
      required_item_name: promo.required_item_name || '',
      min_order: promo.min_order.toString(),
      max_usage: promo.max_usage.toString(),
      valid_until: promo.valid_until ? new Date(promo.valid_until).toISOString().split('T')[0] : '',
      image_url: promo.image_url || '',
      category: promo.category || 'Semua',
      target_promo: 'Per Produk',
      product_id: promo.product_id || null,
      category_id: null,
    });
    isTitleAuto.current = false;
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingPromo(null);
    setForm({
      title: '',
      description: '',
      coin_cost: '',
      discount_type: 'percentage',
      discount_value: '',
      free_item_name: '',
      required_item_name: '',
      min_order: '0',
      max_usage: '100',
      valid_until: '',
      image_url: '',
      category: 'Semua',
      target_promo: 'Per Produk',
      product_id: null,
      category_id: null,
    });
    isTitleAuto.current = true;
    setSelectedFile(null);
  };

  const generateAutoTitle = (currentForm: typeof form, prods: any[]) => {
    if (!isTitleAuto.current) return currentForm;

    const { discount_type, discount_value, product_id } = currentForm;
    const prod = prods.find(p => p.id === product_id);
    const suffix = prod ? prod.name : '';

    let newTitle = '';
    if (discount_type === 'percentage') {
      const val = discount_value ? `${discount_value}%` : '[Nilai_Diskon]%';
      const sfx = suffix || '[Produk]';
      newTitle = `Diskon ${val} ${sfx}`;
    } else if (discount_type === 'fixed') {
      const val = discount_value ? `Rp ${parseInt(discount_value).toLocaleString('id-ID')}` : 'Rp [Nilai_Diskon]';
      const sfx = suffix || '[Produk]';
      newTitle = `Potongan ${val} ${sfx}`;
    } else if (discount_type === 'free_item') {
      const reqSfx = currentForm.required_item_name || suffix || '[Nama_Produk]';
      const freeSfx = currentForm.free_item_name || '[Item_Gratis]';
      newTitle = `Beli ${reqSfx} Gratis ${freeSfx}`;
    }

    return {
      ...currentForm,
      title: newTitle,
    };
  };

  const handleTitleChange = (val: string) => {
    isTitleAuto.current = val === '';
    setForm(prev => ({ ...prev, title: val }));
  };

  const handleDiscountTypeChange = (type: 'percentage' | 'fixed' | 'free_item') => {
    let newDiscountValue = form.discount_value;

    if (type === 'free_item') {
      newDiscountValue = '';
    }

    const updatedForm = {
      ...form,
      discount_type: type,
      discount_value: newDiscountValue,
    };

    const nextForm = generateAutoTitle(updatedForm, productsCatalog);
    setForm(nextForm);
  };

  const handleDiscountValueChange = (val: string) => {
    const updatedForm = {
      ...form,
      discount_value: val,
    };
    const nextForm = generateAutoTitle(updatedForm, productsCatalog);
    setForm(nextForm);
  };

  const handleProductChange = (prodId: string) => {
    const selectedProd = productsCatalog.find(p => p.id === prodId);
    const updatedForm = {
      ...form,
      product_id: prodId || null,
      required_item_name: selectedProd ? selectedProd.name : '',
    };
    const nextForm = generateAutoTitle(updatedForm, productsCatalog);
    setForm(nextForm);
  };

  const fetchAll = async () => {
    const [p, u, t, prod] = await Promise.all([
      fetch('/api/coin-promos').then(r=>r.json()).catch(() => []),
      fetch('/api/users').then(r=>r.json()).catch(() => []),
      fetch('/api/users/transactions').then(r=>r.json()).catch(() => []), // updated endpoint to users/transactions based on usersRouter
      fetch('/api/admin/catalog/products').then(r=>r.json()).catch(() => []),
    ]);
    setPromos(p);
    setUsers(u);
    setTransactions(t);
    setProductsCatalog(Array.isArray(prod) ? prod : []);
  };
  useEffect(() => { fetchAll(); }, []);

  useEffect(() => {
    if (!selectedUser) { setRecs([]); return; }
    fetch(`/api/users/${selectedUser}/recommendations`)
      .then(r=>r.json())
      .then(d => {
        const allRecs = d.recommendations || [];
        setRecs(allRecs.filter((r: any) => r.product_id !== null));
      });
  }, [selectedUser, promos]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(()=>setToast(''), 3000); };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.product_id) {
      showToast('Harap pilih produk terlebih dahulu');
      return;
    }
    setIsUploading(true);
    let finalImageUrl = form.image_url;

    if (selectedFile) {
      const formData = new FormData();
      formData.append("file", selectedFile);
      try {
        const uploadRes = await fetch('/api/coin-promos/upload', { method: 'POST', body: formData });
        if (uploadRes.ok) {
          const data = await uploadRes.json();
          finalImageUrl = data.file_url;
        }
      } catch (err) {
        console.error("Gagal upload gambar", err);
      }
    }

    const payload = {
      ...form,
      image_url: finalImageUrl,
      product_id: form.product_id,
      category_id: null,
      free_item_name: form.discount_type === 'free_item' ? form.free_item_name : null,
      required_item_name: form.required_item_name || productsCatalog.find(p => p.id === form.product_id)?.name || null,
      discount_value: form.discount_type === 'free_item' ? 0 : (parseInt(form.discount_value) || 0)
    };

    let res;
    if (editingPromo) {
      res = await fetch(`/api/coin-promos/${editingPromo.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-name': user?.name || 'Super Admin'
        },
        body: JSON.stringify(payload)
      });
    } else {
      res = await fetch('/api/coin-promos', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-name': user?.name || 'Super Admin'
        },
        body: JSON.stringify(payload)
      });
    }

    setIsUploading(false);
    if (res.ok) {
      showToast(editingPromo ? 'Promo berhasil diperbarui!' : 'Promo berhasil dibuat!');
      handleCloseForm();
      fetchAll();
    }
  };

  const handleToggle = async (id: string) => {
    await fetch(`/api/coin-promos/${id}/toggle`, { 
      method: 'PATCH',
      headers: {
        'x-user-name': user?.name || 'Super Admin'
      }
    });
    fetchAll();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus promo ini?')) return;
    await fetch(`/api/coin-promos/${id}`, { 
      method: 'DELETE',
      headers: {
        'x-user-name': user?.name || 'Super Admin'
      }
    });
    fetchAll(); showToast('Promo dihapus');
  };

  const handleRedeem = async (promoId: string) => {
    if (!selectedUser) return;
    const res = await fetch(`/api/coin-promos/${promoId}/redeem`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ user_id: selectedUser }) });
    const data = await res.json();
    if (res.ok) { showToast(data.message); fetchAll(); }
    else showToast(data.message || 'Gagal');
  };

  // Only show promos linked to a specific product
  const productPromos = promos.filter(p => p.product_id !== null && p.product_id !== undefined && p.product_id !== '');
  const filtered = productPromos.filter(p => filter==='all' ? true : filter==='active' ? p.is_active : !p.is_active);
  const totalCoinsCirculating = users.reduce((a,u) => a + u.coin_balance, 0);
  const totalRedeemed = transactions.filter(t=>t.type==='redeem').reduce((a,t)=>a+t.amount, 0);
  const activeCount = productPromos.filter(p=>p.is_active).length;

  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' });
  const isExpired = (d: string) => new Date(d) < new Date();

  return (
    <div className="space-y-6 pb-16">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{opacity:0,y:-20}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-20}} className="fixed top-6 right-6 z-50 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-lg text-sm font-bold flex items-center gap-2">
            <CheckCircle2 size={16}/> {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-200">
              <Tag size={22}/>
            </div>
            Manajemen Promo Produk
          </h2>
          <p className="text-sm text-slate-500 mt-1">Buat & kelola promo koin yang berlaku khusus per produk</p>
        </div>
        <button onClick={() => { if (showForm) { handleCloseForm(); } else { setShowForm(true); } }} className={cn("flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg", showForm ? "bg-slate-200 text-slate-600 shadow-none" : "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-indigo-200 hover:shadow-indigo-300")}>
          {showForm ? <><X size={16}/> Tutup</> : <><Plus size={16}/> Buat Promo Baru</>}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label:'Total Promo Aktif', value: activeCount, icon:<Gift size={20}/>, color:'from-indigo-500 to-violet-500', shadow:'shadow-indigo-200' },
          { label:'Koin Beredar', value: totalCoinsCirculating.toLocaleString(), icon:<Coins size={20}/>, color:'from-amber-400 to-orange-500', shadow:'shadow-amber-200' },
          { label:'Total Penukaran', value: transactions.filter(t=>t.type==='redeem').length, icon:<Tag size={20}/>, color:'from-emerald-500 to-teal-500', shadow:'shadow-emerald-200' },
          { label:'Koin Ditukar', value: totalRedeemed.toLocaleString(), icon:<TrendingUp size={20}/>, color:'from-rose-400 to-pink-500', shadow:'shadow-rose-200' },
        ].map((s,i) => (
          <motion.div key={s.label} initial={{opacity:0,y:15}} animate={{opacity:1,y:0}} transition={{delay:i*0.08}} className="bg-white rounded-2xl border border-slate-100 p-5 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
            <div className={cn("p-3 rounded-xl bg-gradient-to-br text-white shadow-lg", s.color, s.shadow)}>{s.icon}</div>
            <div>
              <p className="text-xl font-bold text-slate-900">{s.value}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{s.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Create Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:'auto'}} exit={{opacity:0,height:0}} className="overflow-hidden">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <h3 className="font-bold text-slate-900 mb-5 flex items-center gap-2">
                {editingPromo ? <Pencil size={16} className="text-indigo-500"/> : <Plus size={16} className="text-indigo-500"/>}
                {editingPromo ? 'Edit Promo Produk' : 'Buat Promo Produk Baru'}
              </h3>
              <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Pilih Produk */}
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Pilih Produk {form.discount_type === 'free_item' ? '(Yang Digratiskan)' : ''} *
                  </label>
                  <select
                    required
                    value={form.product_id || ''}
                    onChange={e => handleProductChange(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="">— Pilih Produk —</option>
                    {productsCatalog.map((p: any) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Judul Promo */}
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Judul Promo *</label>
                  <input
                    required
                    value={form.title}
                    onChange={e => handleTitleChange(e.target.value)}
                    placeholder="misal: Diskon 30% Mie Yamin"
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                {/* Deskripsi */}
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Deskripsi</label>
                  <textarea
                    value={form.description}
                    onChange={e => setForm({ ...form, description: e.target.value })}
                    rows={2}
                    placeholder="Jelaskan detail promo..."
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none"
                  />
                </div>

                {/* Biaya Koin */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Biaya Koin *</label>
                  <div className="relative">
                    <Coins size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-400" />
                    <input
                      required
                      type="number"
                      min={1}
                      value={form.coin_cost}
                      onChange={e => setForm({ ...form, coin_cost: e.target.value })}
                      placeholder="500"
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-9 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                </div>

                {/* Tipe Diskon */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tipe Diskon</label>
                  <div className="flex gap-2">
                    {(['percentage', 'fixed', 'free_item'] as const).map(t => (
                      <button
                        type="button"
                        key={t}
                        onClick={() => handleDiscountTypeChange(t)}
                        className={cn(
                          "flex-1 py-3 rounded-xl text-xs font-bold border transition-all",
                          form.discount_type === t
                            ? "bg-indigo-55 bg-indigo-50 text-indigo-700 border-indigo-300"
                            : "bg-slate-50 text-slate-400 border-slate-100"
                        )}
                      >
                        {t === 'percentage' ? '% Persentase' : t === 'fixed' ? 'Rp Nominal' : 'Gratis Item'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Nilai Diskon / Item Gratis */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    {form.discount_type === 'free_item' ? 'Item Gratis *' : 'Nilai Diskon *'}
                  </label>
                  <div className="relative">
                    {form.discount_type !== 'free_item' && (
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">
                        {form.discount_type === 'percentage' ? '%' : 'Rp'}
                      </span>
                    )}
                    {form.discount_type === 'free_item' ? (
                      <select
                        required
                        value={form.free_item_name || ''}
                        onChange={e => {
                          const updated = { ...form, free_item_name: e.target.value };
                          setForm(generateAutoTitle(updated, productsCatalog));
                        }}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                      >
                        <option value="">— Pilih Item Gratis —</option>
                        {productsCatalog.map((p: any) => (
                          <option key={p.id} value={p.name}>{p.name}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        required
                        type="number"
                        min={1}
                        value={form.discount_value}
                        onChange={e => handleDiscountValueChange(e.target.value)}
                        placeholder={form.discount_type === 'percentage' ? "20" : "10000"}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-9 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                    )}
                  </div>
                </div>

                {/* Min Order */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Min. Order (Rp)</label>
                  <input
                    type="number"
                    min={0}
                    value={form.min_order}
                    onChange={e => setForm({ ...form, min_order: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                {/* Kuota Penukaran */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Kuota Penukaran</label>
                  <input
                    type="number"
                    min={1}
                    value={form.max_usage}
                    onChange={e => setForm({ ...form, max_usage: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                {/* Berlaku Sampai */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Berlaku Sampai</label>
                  <input
                    type="date"
                    value={form.valid_until}
                    onChange={e => setForm({ ...form, valid_until: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                {/* Gambar Promo */}
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Gambar Promo (Upload)</label>
                  <div
                    className="border-2 border-dashed border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-55 hover:bg-slate-50 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept="image/*"
                      onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                    />
                    {selectedFile ? (
                      <p className="text-sm font-bold text-indigo-600">{selectedFile.name}</p>
                    ) : (
                      <p className="text-sm text-slate-400">Klik untuk memilih gambar</p>
                    )}
                  </div>
                </div>

                {/* Submit Button */}
                <div className="md:col-span-2">
                  <button
                    type="submit"
                    disabled={isUploading}
                    className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl text-sm font-bold hover:from-indigo-700 hover:to-violet-750 transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    <Coins size={16} /> {isUploading ? 'Menyimpan...' : (editingPromo ? 'Simpan Perubahan' : 'Simpan Promo')}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Promo List */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-50 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 flex items-center gap-2"><Tag size={16} className="text-indigo-500"/> Daftar Promo Produk</h3>
              <div className="flex gap-1.5">
                {([['all','Semua'],['active','Aktif'],['inactive','Nonaktif']] as const).map(([k,l])=>(
                  <button key={k} onClick={()=>setFilter(k)} className={cn("px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all", filter===k ? "bg-indigo-500 text-white border-indigo-500" : "bg-white text-slate-500 border-slate-200")}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div className="divide-y divide-slate-50">
              {filtered.length === 0 && <div className="p-10 text-center text-sm text-slate-400">Belum ada promo produk</div>}
              <AnimatePresence>
                {filtered.map(p => (
                  <motion.div key={p.id} layout initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0,x:-30}} className={cn("p-4 flex gap-4 items-start group transition-all border-l-4", p.is_active ? "border-l-indigo-400 hover:bg-indigo-50/20" : "border-l-slate-200 opacity-60 hover:bg-slate-50")}>
                    {/* Image */}
                    {p.image_url && (
                      <div className="w-20 h-20 rounded-xl overflow-hidden border border-slate-100 shrink-0 shadow-sm">
                        <img src={p.image_url} alt={p.title} className="w-full h-full object-cover"/>
                      </div>
                    )}
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h4 className="text-sm font-bold text-slate-900 truncate">{p.title}</h4>
                        <span className={cn("text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border", p.is_active ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-slate-100 text-slate-400 border-slate-200")}>
                          {p.is_active ? '● Aktif' : '○ Nonaktif'}
                        </span>
                        {isExpired(p.valid_until) && <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-50 text-rose-500 border border-rose-200">Kedaluwarsa</span>}
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-1 mb-2">{p.description}</p>
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">
                          <Coins size={10}/> {p.coin_cost} Koin
                        </span>
                        <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                          {p.discount_type==='percentage' ? `${p.discount_value}%` : p.discount_type==='fixed' ? `Rp ${p.discount_value.toLocaleString()}` : (p.required_item_name ? `Beli ${p.required_item_name} Gratis ${p.free_item_name}` : `Gratis ${p.free_item_name}`)}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-400">
                          {p.used_count}/{p.max_usage} dipakai
                        </span>
                        <span className="text-[10px] text-slate-400">s/d {fmtDate(p.valid_until)}</span>
                      </div>
                      {/* Usage bar */}
                      <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden w-full max-w-[200px]">
                        <div className={cn("h-full rounded-full transition-all", p.used_count>=p.max_usage ? "bg-rose-400" : "bg-indigo-400")} style={{width:`${Math.min(100,(p.used_count/p.max_usage)*100)}%`}}/>
                      </div>
                    </div>
                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={()=>handleToggle(p.id)} title={p.is_active?'Nonaktifkan':'Aktifkan'} className={cn("p-2 rounded-lg text-xs transition-all", p.is_active ? "text-emerald-500 hover:bg-emerald-50" : "text-slate-400 hover:bg-slate-100")}>
                        {p.is_active ? <ToggleRight size={18}/> : <ToggleLeft size={18}/>}
                      </button>
                      <button onClick={()=>startEdit(p)} className="p-2 text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-all" title="Edit Promo">
                        <Pencil size={16}/>
                      </button>
                      <button onClick={()=>handleDelete(p.id)} className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all" title="Hapus Promo">
                        <Trash2 size={16}/>
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Right Panel: User Recommendations + Transactions */}
        <div className="space-y-6">
          {/* User Selector + Recommendations */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><Users size={16} className="text-indigo-500"/> Rekomendasi per User</h3>
            <select value={selectedUser} onChange={e=>setSelectedUser(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
              <option value="">— Pilih User —</option>
              {users.map(u=><option key={u.id} value={u.id}>{u.nama} ({u.coin_balance.toLocaleString()} koin)</option>)}
            </select>

            {selectedUser && (
              <div className="space-y-3">
                {/* User coin display */}
                <div className="bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl p-4 text-white">
                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">Saldo Koin</p>
                  <p className="text-2xl font-black">{users.find(u=>u.id===selectedUser)?.coin_balance.toLocaleString() || 0} <span className="text-sm font-bold opacity-77 opacity-80">koin</span></p>
                </div>

                {recs.length === 0 && <p className="text-xs text-slate-400 text-center py-4">Tidak ada promo tersedia</p>}
                {recs.map(r => (
                  <div key={r.id} className={cn("border rounded-xl p-3 transition-all", r.can_redeem ? "border-emerald-200 bg-emerald-50/30" : "border-slate-100")}>
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-xs font-bold text-slate-800 truncate flex-1">{r.title}</h4>
                      <span className={cn("text-[9px] font-black px-2 py-0.5 rounded-full ml-2", r.can_redeem ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-400")}>
                        {r.can_redeem ? '✓ Bisa Tukar' : r.is_out_of_stock ? 'Stok Habis' : `Kurang ${r.coins_needed}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] font-bold text-amber-600"><Coins size={10} className="inline mr-0.5"/>{r.coin_cost}</span>
                      <span className="text-[10px] text-slate-400">•</span>
                      <span className="text-[10px] text-slate-500">{r.discount_type==='percentage' ? `${r.discount_value}% off` : r.discount_type==='fixed' ? `Rp ${r.discount_value.toLocaleString()}` : (r.required_item_name ? `Beli ${r.required_item_name} Gratis ${r.free_item_name}` : `Gratis ${r.free_item_name}`)}</span>
                    </div>
                    {/* Progress bar */}
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-2">
                      <motion.div initial={{width:0}} animate={{width:`${r.progress}%`}} className={cn("h-full rounded-full", r.can_redeem ? "bg-emerald-400" : "bg-indigo-400")}/>
                    </div>
                    {r.can_redeem && !r.is_out_of_stock && (
                      <button onClick={()=>handleRedeem(r.id)} className="w-full py-2 bg-emerald-500 text-white rounded-lg text-[11px] font-bold hover:bg-emerald-600 transition-all flex items-center justify-center gap-1.5">
                        <Gift size={12}/> Tukarkan Sekarang
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Transactions */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><Clock size={16} className="text-indigo-500"/> Riwayat Koin Terbaru</h3>
            <div className="space-y-2">
              {transactions.slice(0, 8).map(tx => (
                <div key={tx.id} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", tx.type==='earn' ? "bg-emerald-50 text-emerald-500" : "bg-rose-50 text-rose-500")}>
                    {tx.type==='earn' ? <ArrowDown size={14}/> : <ArrowUp size={14}/>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-700 truncate">{tx.user_name}</p>
                    <p className="text-[10px] text-slate-400 truncate">{tx.description}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={cn("text-xs font-bold", tx.type==='earn' ? "text-emerald-600" : "text-rose-500")}>
                      {tx.type==='earn' ? '+' : '-'}{tx.amount}
                    </p>
                    <p className="text-[9px] text-slate-400">{new Date(tx.created_at).toLocaleTimeString('id-ID', {hour:'2-digit',minute:'2-digit'})}</p>
                  </div>
                </div>
              ))}
              {transactions.length===0 && <p className="text-xs text-slate-400 text-center py-4">Belum ada transaksi</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
