import React, { useState, useEffect, useCallback } from 'react';
import {
  UtensilsCrossed, Search, CheckCircle2, XCircle, Plus, Pencil, Trash2,
  Upload, X, Package, Coffee, ArrowRight, RefreshCcw, Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/src/lib/utils';

interface MenuItem {
  id: string | number;
  name: string;
  category: string;
  price: number;
  inStock: boolean;
  stock: number;
  image: string;
  outlet: string;
  description?: string;
}

type ActiveOutlet = 'ngolab' | 'coworking';

const NGOLAB_CATEGORIES = ['Semua', 'Main Course', 'Beverage', 'Snack'];
const COWORKING_CATEGORIES = ['Semua', 'Ready Meal', 'Makanan Ringan', 'Es Krim', 'Minuman Siap Saji'];

const DEFAULT_NEW = (outlet: ActiveOutlet) => ({
  name: '',
  category: outlet === 'ngolab' ? 'Main Course' : 'Ready Meal',
  price: '',
  stock: '',
  image: '',
  description: '',
});

interface MenuManagementProps {
  /** allow parent Layout to navigate to catalog tabs */
  onNavigate?: (tab: string) => void;
}

export default function MenuManagement({ onNavigate }: MenuManagementProps) {
  const [activeOutlet, setActiveOutlet] = useState<ActiveOutlet>('ngolab');
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Semua');

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<MenuItem | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<MenuItem | null>(null);

  const [newProduct, setNewProduct] = useState(DEFAULT_NEW('ngolab'));
  const [dragActive, setDragActive] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const categories = activeOutlet === 'ngolab' ? NGOLAB_CATEGORIES : COWORKING_CATEGORIES;

  const fetchMenu = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/menu?outlet=${activeOutlet}`;
      if (selectedCategory !== 'Semua') url += `&category=${encodeURIComponent(selectedCategory)}`;
      // x-api-key memaksa server bypass Smart Tag dan langsung baca dari database lokal
      const res = await fetch(url, {
        headers: { 'x-api-key': 'tangolab-secret-key-2026' }
      });
      const data = await res.json();
      setMenuItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch menu:', err);
      setMenuItems([]);
    } finally {
      setLoading(false);
    }
  }, [activeOutlet, selectedCategory]);

  useEffect(() => {
    setSelectedCategory('Semua');
  }, [activeOutlet]);

  useEffect(() => {
    fetchMenu();
  }, [fetchMenu]);

  // ── File handling ───────────────────────────────────────────────────
  const applyFile = (file: File, forEdit: boolean) => {
    if (file.size > 5 * 1024 * 1024) { alert('Maks 5MB.'); return; }
    const reader = new FileReader();
    reader.onloadend = () => {
      if (forEdit) setEditingProduct(p => p ? { ...p, image: reader.result as string } : null);
      else setNewProduct(p => ({ ...p, image: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, forEdit = false) => {
    const file = e.target.files?.[0];
    if (file) applyFile(file, forEdit);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  };

  const handleDrop = (e: React.DragEvent, forEdit = false) => {
    e.preventDefault(); e.stopPropagation(); setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) applyFile(file, forEdit);
  };

  // ── CRUD ────────────────────────────────────────────────────────────
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await fetch('/api/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newProduct, outlet: activeOutlet }),
      });
      if (res.ok) {
        setIsAddModalOpen(false);
        setNewProduct(DEFAULT_NEW(activeOutlet));
        fetchMenu();
      }
    } catch (err) { console.error('Add failed:', err); }
    finally { setIsSaving(false); }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/menu/${editingProduct.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingProduct),
      });
      if (res.ok) { setEditingProduct(null); fetchMenu(); }
    } catch (err) { console.error('Update failed:', err); }
    finally { setIsSaving(false); }
  };

  const handleDelete = async (item: MenuItem) => {
    try {
      const res = await fetch(`/api/menu/${item.id}`, { method: 'DELETE' });
      if (res.ok) { setDeleteConfirm(null); fetchMenu(); }
    } catch (err) { console.error('Delete failed:', err); }
  };

  const toggleStock = async (id: string | number) => {
    try {
      const res = await fetch(`/api/menu/${id}/toggle-stock`, { method: 'PATCH' });
      if (res.ok) {
        const result = await res.json();
        setMenuItems(prev => prev.map(item => item.id === id ? result.item : item));
      }
    } catch (err) { console.error('Toggle failed:', err); }
  };

  const filteredMenu = menuItems.filter(i =>
    i.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: menuItems.length,
    available: menuItems.filter(i => i.inStock).length,
    unavailable: menuItems.filter(i => !i.inStock).length,
  };

  const accentNgolab = 'indigo';
  const accentCw = 'amber';
  const accent = activeOutlet === 'ngolab' ? accentNgolab : accentCw;

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <div className="space-y-8 pb-12">

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 bg-violet-50 rounded-2xl border border-violet-100">
              <UtensilsCrossed size={22} className="text-violet-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 leading-tight">
              Manajemen Menu
            </h2>
          </div>
          <p className="text-sm text-slate-500 font-medium ml-[52px]">
            CRUD terpusat untuk semua produk menu — Ngolab &amp; Coworking.
          </p>
        </div>

        {/* Quick-nav buttons to Catalog tabs */}
        <div className="flex gap-3 shrink-0">
          {onNavigate && (
            <>
              <button
                onClick={() => onNavigate('stock')}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-100 text-xs font-bold hover:bg-indigo-100 transition-all"
              >
                <Package size={14} /> Lihat Katalog Ngolab <ArrowRight size={12} />
              </button>
              <button
                onClick={() => onNavigate('coworking-menu')}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 text-amber-700 border border-amber-100 text-xs font-bold hover:bg-amber-100 transition-all"
              >
                <Coffee size={14} /> Lihat Katalog Coworking <ArrowRight size={12} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Outlet Switcher ── */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-2xl w-fit border border-slate-200">
        {(['ngolab', 'coworking'] as ActiveOutlet[]).map(o => (
          <button
            key={o}
            onClick={() => setActiveOutlet(o)}
            className={cn(
              'flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all',
              activeOutlet === o
                ? o === 'ngolab'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'bg-white text-amber-600 shadow-sm'
                : 'text-slate-400 hover:text-slate-700'
            )}
          >
            {o === 'ngolab' ? <Package size={14} /> : <Coffee size={14} />}
            Menu {o === 'ngolab' ? 'Ngolab' : 'Coworking'}
          </button>
        ))}
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Menu', value: stats.total, color: 'violet', icon: UtensilsCrossed },
          { label: 'Tersedia', value: stats.available, color: 'emerald', icon: CheckCircle2 },
          { label: 'Habis', value: stats.unavailable, color: 'rose', icon: XCircle },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-slate-100 p-5 flex items-center gap-4 shadow-sm">
            <div className={`p-3 rounded-xl bg-${s.color}-50`}>
              <s.icon size={20} className={`text-${s.color}-600`} />
            </div>
            <div>
              <p className="text-2xl font-black text-slate-900">{s.value}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Toolbar ── */}
      <div className="flex flex-col xl:flex-row items-center gap-4">
        <div className="relative flex-1 group w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 transition-colors" />
          <input
            type="text"
            placeholder={`Cari menu ${activeOutlet === 'ngolab' ? 'Ngolab' : 'Coworking'}...`}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-slate-100 rounded-2xl pl-12 pr-4 py-3.5 text-sm focus:outline-none focus:ring-4 focus:ring-violet-500/10 transition-all font-medium"
          />
        </div>
        <div className="flex items-center gap-2 p-1 bg-white border border-slate-100 rounded-2xl overflow-x-auto w-full xl:w-auto scrollbar-hide">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                'px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all',
                selectedCategory === cat
                  ? activeOutlet === 'ngolab'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                    : 'bg-amber-600 text-white shadow-md shadow-amber-200'
                  : 'text-slate-500 hover:bg-slate-50'
              )}
            >
              {cat}
            </button>
          ))}
        </div>
        <button
          onClick={() => { setNewProduct(DEFAULT_NEW(activeOutlet)); setIsAddModalOpen(true); }}
          className={cn(
            'px-5 py-3.5 rounded-2xl text-white font-bold text-xs shadow-lg flex items-center gap-2 whitespace-nowrap transition-all',
            activeOutlet === 'ngolab'
              ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
              : 'bg-amber-600 hover:bg-amber-700 shadow-amber-200'
          )}
        >
          <Plus size={18} /> Tambah Menu
        </button>
      </div>

      {/* ── Content: Ngolab = Grid, Coworking = Table ── */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className={cn(
            'animate-spin w-10 h-10 border-4 rounded-full',
            activeOutlet === 'ngolab'
              ? 'border-indigo-200 border-t-indigo-600'
              : 'border-amber-200 border-t-amber-600'
          )} />
        </div>
      ) : filteredMenu.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400">
          <UtensilsCrossed size={48} className="mb-4 opacity-30" />
          <p className="font-bold text-sm">Belum ada menu</p>
          <p className="text-xs mt-1">Tambahkan produk baru untuk outlet ini.</p>
        </div>

      ) : activeOutlet === 'ngolab' ? (
        /* ── NGOLAB: Card Grid ── */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredMenu.map(item => (
            <motion.div
              key={item.id}
              layout
              className={cn(
                'relative bg-white rounded-[2rem] border-2 transition-all duration-300 overflow-hidden group p-2',
                !item.inStock
                  ? 'border-rose-100'
                  : 'border-slate-100 hover:border-indigo-200 shadow-sm hover:shadow-xl'
              )}
            >
              <div className="absolute top-4 left-4 z-10 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-indigo-600 text-white">
                Ngolab
              </div>

              <div className="relative aspect-video rounded-[1.5rem] overflow-hidden mb-2">
                <img
                  src={item.image}
                  alt={item.name}
                  className={cn(
                    'w-full h-full object-cover transition-transform duration-700 group-hover:scale-110',
                    !item.inStock && 'grayscale opacity-40'
                  )}
                  referrerPolicy="no-referrer"
                  onError={e => {
                    (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&q=80';
                  }}
                />
                {!item.inStock && (
                  <div className="absolute inset-0 bg-slate-900/40 flex items-center justify-center">
                    <div className="bg-white/90 backdrop-blur-md p-3 rounded-2xl shadow-xl">
                      <XCircle size={28} className="text-rose-500" />
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 flex flex-col gap-2">
                <div>
                  <span className="inline-block px-2 py-0.5 rounded bg-indigo-50 text-indigo-600 text-[9px] font-black uppercase tracking-widest mb-1">
                    {item.category}
                  </span>
                  <h3 className="text-sm font-bold text-slate-900 leading-tight line-clamp-2">{item.name}</h3>
                  {item.description && (
                    <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-snug">{item.description}</p>
                  )}
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                  <p className="text-[13px] font-black text-indigo-600 whitespace-nowrap">
                    Rp {item.price.toLocaleString()}
                  </p>
                  <div className={cn(
                    'inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest',
                    item.inStock ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'
                  )}>
                    {item.inStock ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                    {item.inStock ? 'Tersedia' : 'Habis'}
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 font-bold">Stok: {item.stock}</p>
                <div className="flex gap-2 mt-2">
                  <button onClick={() => setEditingProduct(item)}
                    className="flex-1 py-2 bg-white text-slate-600 rounded-xl text-[10px] font-bold uppercase transition-all hover:bg-slate-50 border border-slate-200 active:scale-95 shadow-sm flex items-center justify-center gap-1">
                    <Pencil size={12} /> Edit
                  </button>
                  <button onClick={() => toggleStock(item.id)}
                    className={cn(
                      'flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95',
                      item.inStock
                        ? 'bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-100'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700'
                    )}>
                    {item.inStock ? 'Nonaktif' : 'Aktifkan'}
                  </button>
                  <button onClick={() => setDeleteConfirm(item)}
                    className="py-2 px-3 bg-white text-slate-400 rounded-xl text-[10px] border border-slate-200 hover:text-rose-600 hover:border-rose-200 transition-all active:scale-95">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

      ) : (
        /* ── COWORKING: Data Table ── */
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 w-16">Foto</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Nama Menu</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Kategori</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Harga</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Stok</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Status</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredMenu.map((item, idx) => (
                  <motion.tr
                    key={item.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className="hover:bg-amber-50/40 transition-colors group"
                  >
                    {/* Foto */}
                    <td className="px-6 py-3">
                      <div className="w-12 h-12 rounded-2xl overflow-hidden border border-slate-100 shrink-0">
                        <img
                          src={item.image}
                          alt={item.name}
                          className={cn(
                            'w-full h-full object-cover transition-transform duration-300 group-hover:scale-110',
                            !item.inStock && 'grayscale opacity-50'
                          )}
                          referrerPolicy="no-referrer"
                          onError={e => {
                            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200&q=80';
                          }}
                        />
                      </div>
                    </td>

                    {/* Nama */}
                    <td className="px-6 py-3">
                      <p className="text-sm font-bold text-slate-900 leading-tight">{item.name}</p>
                      {item.description && (
                        <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{item.description}</p>
                      )}
                    </td>

                    {/* Kategori */}
                    <td className="px-6 py-3">
                      <span className="inline-block px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 text-[9px] font-black uppercase tracking-widest whitespace-nowrap">
                        {item.category}
                      </span>
                    </td>

                    {/* Harga */}
                    <td className="px-6 py-3">
                      <p className="text-sm font-black text-amber-700 whitespace-nowrap">
                        Rp {item.price.toLocaleString()}
                      </p>
                    </td>

                    {/* Stok */}
                    <td className="px-6 py-3 text-center">
                      <span className={cn(
                        'inline-block text-sm font-black font-mono',
                        item.stock <= 5 ? 'text-rose-500' : 'text-slate-700'
                      )}>
                        {item.stock}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-6 py-3 text-center">
                      <button
                        onClick={() => toggleStock(item.id)}
                        className={cn(
                          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 border',
                          item.inStock
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-100'
                            : 'bg-rose-50 text-rose-600 border-rose-100 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-100'
                        )}
                        title="Klik untuk toggle status"
                      >
                        {item.inStock ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                        {item.inStock ? 'Tersedia' : 'Habis'}
                      </button>
                    </td>

                    {/* Aksi */}
                    <td className="px-6 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setEditingProduct(item)}
                          className="flex items-center gap-1.5 px-3 py-2 bg-white text-slate-600 rounded-xl text-[10px] font-bold uppercase border border-slate-200 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200 transition-all active:scale-95 shadow-sm whitespace-nowrap"
                        >
                          <Pencil size={12} /> Edit
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(item)}
                          className="p-2 bg-white text-slate-400 rounded-xl border border-slate-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-all active:scale-95 shadow-sm"
                          title="Hapus"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Table Footer */}
          <div className="px-6 py-4 border-t border-slate-50 bg-slate-50/50 flex items-center justify-between">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Total: <span className="text-slate-700">{filteredMenu.length}</span> menu coworking
            </p>
            <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest">
              <span className="text-emerald-600">● {filteredMenu.filter(i => i.inStock).length} Tersedia</span>
              <span className="text-rose-500">● {filteredMenu.filter(i => !i.inStock).length} Habis</span>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════ ADD MODAL ═══════════════════ */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsAddModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl p-8 overflow-y-auto max-h-[90vh]"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">
                    Tambah Menu {activeOutlet === 'ngolab' ? 'Ngolab' : 'Coworking'}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">Isi detail produk baru.</p>
                </div>
                <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X size={22} className="text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleAdd} className="space-y-4">
                <ModalField label="Nama Produk">
                  <input required type="text" value={newProduct.name}
                    onChange={e => setNewProduct({ ...newProduct, name: e.target.value })}
                    placeholder="Contoh: Nasi Goreng Gila"
                    className="modal-input" />
                </ModalField>

                <ModalField label="Deskripsi">
                  <textarea value={newProduct.description}
                    onChange={e => setNewProduct({ ...newProduct, description: e.target.value })}
                    placeholder="Deskripsi singkat produk..." rows={2}
                    className="modal-input resize-none" />
                </ModalField>

                <div className="grid grid-cols-2 gap-4">
                  <ModalField label="Kategori">
                    <select value={newProduct.category}
                      onChange={e => setNewProduct({ ...newProduct, category: e.target.value })}
                      className="modal-input">
                      {(activeOutlet === 'ngolab'
                        ? ['Main Course', 'Beverage', 'Snack']
                        : ['Ready Meal', 'Makanan Ringan', 'Es Krim', 'Minuman Siap Saji']
                      ).map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </ModalField>
                  <ModalField label="Harga (Rp)">
                    <input required type="number" value={newProduct.price}
                      onChange={e => setNewProduct({ ...newProduct, price: e.target.value })}
                      placeholder="0" className="modal-input" />
                  </ModalField>
                </div>

                <ModalField label="Stok Awal">
                  <input required type="number" value={newProduct.stock}
                    onChange={e => setNewProduct({ ...newProduct, stock: e.target.value })}
                    placeholder="0" className="modal-input" />
                </ModalField>

                <ModalField label="Foto Produk">
                  <DropZone
                    image={newProduct.image}
                    dragActive={dragActive}
                    onDrag={handleDrag}
                    onDrop={e => handleDrop(e, false)}
                    onClear={() => setNewProduct({ ...newProduct, image: '' })}
                    inputId="mm-add-img"
                    onFileChange={e => handleFileChange(e, false)}
                    accent={activeOutlet}
                  />
                </ModalField>

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setIsAddModalOpen(false)}
                    className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest">
                    Batal
                  </button>
                  <button type="submit" disabled={isSaving}
                    className={cn(
                      'flex-[2] py-4 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg transition-all disabled:opacity-60',
                      activeOutlet === 'ngolab' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-amber-600 hover:bg-amber-700'
                    )}>
                    {isSaving ? 'Menyimpan...' : 'Simpan Menu'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ═══════════════════ EDIT MODAL ═══════════════════ */}
      <AnimatePresence>
        {editingProduct && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setEditingProduct(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl p-8 overflow-y-auto max-h-[90vh]"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Edit Menu</h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">Perbarui detail produk.</p>
                </div>
                <button onClick={() => setEditingProduct(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X size={22} className="text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleUpdate} className="space-y-4">
                <ModalField label="Nama Produk">
                  <input required type="text" value={editingProduct.name}
                    onChange={e => setEditingProduct({ ...editingProduct, name: e.target.value })}
                    className="modal-input" />
                </ModalField>

                <ModalField label="Deskripsi">
                  <textarea value={editingProduct.description || ''}
                    onChange={e => setEditingProduct({ ...editingProduct, description: e.target.value })}
                    rows={2} className="modal-input resize-none" />
                </ModalField>

                <div className="grid grid-cols-2 gap-4">
                  <ModalField label="Kategori">
                    <select value={editingProduct.category}
                      onChange={e => setEditingProduct({ ...editingProduct, category: e.target.value })}
                      className="modal-input">
                      {(activeOutlet === 'ngolab'
                        ? ['Main Course', 'Beverage', 'Snack']
                        : ['Ready Meal', 'Makanan Ringan', 'Es Krim', 'Minuman Siap Saji']
                      ).map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </ModalField>
                  <ModalField label="Harga (Rp)">
                    <input required type="number" value={editingProduct.price}
                      onChange={e => setEditingProduct({ ...editingProduct, price: parseInt(e.target.value) || 0 })}
                      className="modal-input" />
                  </ModalField>
                </div>

                <ModalField label="Stok">
                  <input required type="number" value={editingProduct.stock}
                    onChange={e => setEditingProduct({ ...editingProduct, stock: parseInt(e.target.value) || 0 })}
                    className="modal-input" />
                </ModalField>

                <ModalField label="Foto Produk">
                  <DropZone
                    image={editingProduct.image}
                    dragActive={dragActive}
                    onDrag={handleDrag}
                    onDrop={e => handleDrop(e, true)}
                    onClear={() => setEditingProduct({ ...editingProduct, image: '' })}
                    inputId="mm-edit-img"
                    onFileChange={e => handleFileChange(e, true)}
                    accent={activeOutlet}
                  />
                  <input type="text" value={editingProduct.image}
                    onChange={e => setEditingProduct({ ...editingProduct, image: e.target.value })}
                    placeholder="Atau masukkan URL gambar..."
                    className="modal-input mt-2 text-xs" />
                </ModalField>

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setEditingProduct(null)}
                    className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest">
                    Batal
                  </button>
                  <button type="submit" disabled={isSaving}
                    className={cn(
                      'flex-[2] py-4 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg transition-all disabled:opacity-60',
                      activeOutlet === 'ngolab' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-amber-600 hover:bg-amber-700'
                    )}>
                    {isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ═══════════════════ DELETE CONFIRM ═══════════════════ */}
      <AnimatePresence>
        {deleteConfirm && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirm(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl text-center"
            >
              <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={28} className="text-rose-500" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Hapus Menu?</h3>
              <p className="text-sm text-slate-500 mb-6">
                <span className="font-bold text-slate-900">"{deleteConfirm.name}"</span> akan dihapus secara permanen.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteConfirm(null)}
                  className="flex-1 py-3.5 bg-slate-100 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest">
                  Batal
                </button>
                <button onClick={() => handleDelete(deleteConfirm)}
                  className="flex-[2] py-3.5 bg-rose-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-rose-700 transition-all">
                  Ya, Hapus
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Helper sub-components ────────────────────────────────────────────

function ModalField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}

interface DropZoneProps {
  image: string;
  dragActive: boolean;
  onDrag: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onClear: () => void;
  inputId: string;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  accent: ActiveOutlet;
}

function DropZone({ image, dragActive, onDrag, onDrop, onClear, inputId, onFileChange, accent }: DropZoneProps) {
  return (
    <div
      onDragEnter={onDrag} onDragLeave={onDrag} onDragOver={onDrag} onDrop={onDrop}
      className={cn(
        'relative h-32 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center gap-2 bg-slate-50 cursor-pointer overflow-hidden',
        dragActive
          ? accent === 'ngolab' ? 'border-indigo-500 bg-indigo-50/50' : 'border-amber-500 bg-amber-50/50'
          : image ? 'border-transparent' : 'border-slate-200 hover:border-slate-300'
      )}
      onClick={() => document.getElementById(inputId)?.click()}
    >
      {image ? (
        <>
          <img src={image} className="absolute inset-0 w-full h-full object-cover rounded-2xl" />
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity rounded-2xl">
            <button type="button" onClick={e => { e.stopPropagation(); onClear(); }} className="bg-white/20 backdrop-blur-md p-2 rounded-full text-white">
              <X size={18} />
            </button>
          </div>
        </>
      ) : (
        <>
          <Upload size={20} className="text-slate-400" />
          <p className="text-[10px] font-bold text-slate-400 uppercase">Drag &amp; Drop atau Klik</p>
        </>
      )}
      <input id={inputId} type="file" accept="image/*" onChange={onFileChange} className="hidden" />
    </div>
  );
}
