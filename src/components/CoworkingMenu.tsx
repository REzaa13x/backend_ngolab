import React, { useState, useEffect, useCallback } from 'react';
import { 
  Package, Search, CheckCircle2, XCircle, Plus, Pencil, Trash2,
  Coffee, Upload, Image as ImageIcon, X
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

const COWORKING_CATEGORIES = ['Semua', 'Ready Meal', 'Makanan Ringan', 'Es Krim', 'Minuman Siap Saji'];

export default function CoworkingMenu() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<MenuItem | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<MenuItem | null>(null);
  const [newProduct, setNewProduct] = useState({
    name: '', category: 'Ready Meal', price: '', stock: '', image: '', description: ''
  });
  const [dragActive, setDragActive] = useState(false);

  const fetchMenu = useCallback(async () => {
    try {
      let url = '/api/menu?outlet=coworking';
      if (selectedCategory !== 'Semua') url += `&category=${encodeURIComponent(selectedCategory)}`;
      const res = await fetch(url);
      const data = await res.json();
      setMenuItems(data);
      setLoading(false);
    } catch (err) {
      console.error("Failed to fetch coworking menu:", err);
    }
  }, [selectedCategory]);

  useEffect(() => { fetchMenu(); }, [fetchMenu]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, isEdit = false) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert("Maks 5MB."); return; }
    const reader = new FileReader();
    reader.onloadend = () => {
      if (isEdit) {
        setEditingProduct(p => p ? ({ ...p, image: reader.result as string }) : null);
      } else {
        setNewProduct(p => ({ ...p, image: reader.result as string }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  };

  const handleDrop = (e: React.DragEvent, isEdit = false) => {
    e.preventDefault(); e.stopPropagation(); setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert("Maks 5MB."); return; }
    const reader = new FileReader();
    reader.onloadend = () => {
      if (isEdit) {
        setEditingProduct(p => p ? ({ ...p, image: reader.result as string }) : null);
      } else {
        setNewProduct(p => ({ ...p, image: reader.result as string }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newProduct, outlet: 'coworking' })
      });
      if (res.ok) {
        setIsAddModalOpen(false);
        setNewProduct({ name: '', category: 'Ready Meal', price: '', stock: '', image: '', description: '' });
        fetchMenu();
      }
    } catch (err) { console.error("Failed to add:", err); }
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    try {
      const res = await fetch(`/api/menu/${editingProduct.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingProduct)
      });
      if (res.ok) { setEditingProduct(null); fetchMenu(); }
    } catch (err) { console.error("Failed to update:", err); }
  };

  const handleDelete = async (item: MenuItem) => {
    try {
      const res = await fetch(`/api/menu/${item.id}`, { method: 'DELETE' });
      if (res.ok) { setDeleteConfirm(null); fetchMenu(); }
    } catch (err) { console.error("Failed to delete:", err); }
  };

  const toggleStock = async (id: string | number) => {
    try {
      const res = await fetch(`/api/menu/${id}/toggle-stock`, { method: 'PATCH' });
      if (res.ok) {
        const result = await res.json();
        setMenuItems(prev => prev.map(item => item.id === id ? result.item : item));
      } else {
        const errorData = await res.json().catch(() => ({}));
        alert(errorData.message || "Gagal mengubah status menu.");
      }
    } catch (err) {
      console.error("Failed to toggle:", err);
      alert("Terjadi kesalahan koneksi saat merubah status menu.");
    }
  };

  const filteredMenu = menuItems.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: menuItems.length,
    available: menuItems.filter(i => i.inStock).length,
    outOfStock: menuItems.filter(i => !i.inStock).length,
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 leading-tight flex items-center gap-3">
            <div className="p-2.5 bg-amber-50 rounded-2xl border border-amber-100">
              <Coffee size={22} className="text-amber-600" />
            </div>
            Katalog Menu Coworking
          </h2>
          <p className="text-sm text-slate-500 font-medium tracking-tight mt-1">
            Tampilan katalog produk Coworking. Untuk menambah, mengubah, atau menghapus menu — gunakan halaman <span className="font-bold text-amber-600">Manajemen Menu</span>.
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Menu', value: stats.total, color: 'indigo', icon: Package },
          { label: 'Tersedia', value: stats.available, color: 'emerald', icon: CheckCircle2 },
          { label: 'Habis', value: stats.outOfStock, color: 'rose', icon: XCircle },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-slate-100 p-5 flex items-center gap-4 shadow-sm">
            <div className={cn("p-3 rounded-xl", `bg-${s.color}-50`)}>
              <s.icon size={20} className={`text-${s.color}-600`} />
            </div>
            <div>
              <p className="text-2xl font-black text-slate-900">{s.value}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col xl:flex-row items-center gap-4">
        <div className="relative flex-1 group w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-amber-500 transition-colors" />
          <input
            type="text" placeholder="Cari menu coworking..."
            value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-slate-100 rounded-2xl pl-12 pr-4 py-3.5 text-sm focus:outline-none focus:ring-4 focus:ring-amber-500/10 transition-all font-medium"
          />
        </div>
        <div className="flex items-center gap-2 p-1 bg-white border border-slate-100 rounded-2xl overflow-x-auto w-full xl:w-auto scrollbar-hide">
          {COWORKING_CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setSelectedCategory(cat)}
              className={cn(
                "px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all",
                selectedCategory === cat
                  ? "bg-amber-600 text-white shadow-md shadow-amber-200"
                  : "text-slate-500 hover:bg-slate-50"
              )}
            >{cat}</button>
          ))}
        </div>
      </div>

      {/* Menu Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-8 h-8 border-4 border-amber-200 border-t-amber-600 rounded-full" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredMenu.map(item => (
            <motion.div key={item.id} layout
              className={cn(
                "relative bg-white rounded-[2rem] border-2 transition-all duration-300 overflow-hidden group p-2",
                !item.inStock ? "border-rose-100" : "border-slate-100 shadow-sm hover:shadow-xl hover:border-amber-200"
              )}
            >
              <div className="relative aspect-video rounded-[1.5rem] overflow-hidden mb-2">
                <img src={item.image} alt={item.name}
                  className={cn("w-full h-full object-cover transition-transform duration-700 group-hover:scale-110", !item.inStock && "grayscale opacity-40")}
                  referrerPolicy="no-referrer"
                  onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&q=80'; }}
                />
                {!item.inStock && (
                  <div className="absolute inset-0 bg-slate-900/40 flex items-center justify-center">
                    <div className="bg-white/90 backdrop-blur-md p-3 rounded-2xl shadow-xl">
                      <XCircle size={28} className="text-rose-500" />
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <span className="inline-block px-2 py-0.5 rounded bg-amber-50 text-amber-700 text-[9px] font-black uppercase tracking-widest mb-1.5">
                        {item.category}
                      </span>
                      <h3 className="text-sm font-bold text-slate-900 group-hover:text-amber-700 transition-colors line-clamp-2 leading-tight">
                        {item.name}
                      </h3>
                      {item.description && (
                        <p className="text-[11px] text-slate-400 font-medium mt-1 line-clamp-2 leading-snug">
                          {item.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                    <p className="text-[13px] font-black text-amber-700 whitespace-nowrap">
                      Rp {item.price.toLocaleString()}
                    </p>
                    <div className={cn(
                      "inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest",
                      item.inStock ? "text-emerald-600 bg-emerald-50" : "text-rose-600 bg-rose-50"
                    )}>
                      {item.inStock ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                      {item.inStock ? 'Tersedia' : 'Habis'}
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 font-bold mt-1">Stok: {item.stock}</p>
                </div>

                <div className="flex gap-2 mt-4">
                  <button onClick={() => toggleStock(item.id)}
                    className={cn(
                      "w-full py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-sm",
                      item.inStock
                        ? "bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-100"
                        : "bg-amber-600 text-white hover:bg-amber-700"
                    )}
                  >{item.inStock ? 'Nonaktif' : 'Aktifkan'}</button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* ADD MODAL */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsAddModalOpen(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl p-8 overflow-hidden"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Tambah Menu Coworking</h3>
                  <p className="text-xs text-slate-500 font-medium">Lengkapi data produk untuk area Coworking.</p>
                </div>
                <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X size={24} className="text-slate-400" />
                </button>
              </div>
              <form onSubmit={handleAddProduct} className="space-y-5">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Nama Produk</label>
                  <input required type="text" value={newProduct.name} onChange={e => setNewProduct({ ...newProduct, name: e.target.value })} placeholder="Contoh: Rice Bowl Teriyaki"
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-4 focus:ring-amber-500/10 transition-all" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Deskripsi Produk</label>
                  <textarea value={newProduct.description} onChange={e => setNewProduct({ ...newProduct, description: e.target.value })} placeholder="Masukkan deskripsi singkat produk..." rows={2}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-4 focus:ring-amber-500/10 transition-all resize-none" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Kategori</label>
                    <select value={newProduct.category} onChange={e => setNewProduct({ ...newProduct, category: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-4 focus:ring-amber-500/10 transition-all">
                      <option value="Ready Meal">Ready Meal</option>
                      <option value="Makanan Ringan">Makanan Ringan</option>
                      <option value="Es Krim">Es Krim</option>
                      <option value="Minuman Siap Saji">Minuman Siap Saji</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Harga (Rp)</label>
                    <input required type="number" value={newProduct.price} onChange={e => setNewProduct({ ...newProduct, price: e.target.value })} placeholder="0"
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-4 focus:ring-amber-500/10 transition-all" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Stok Awal</label>
                  <input required type="number" value={newProduct.stock} onChange={e => setNewProduct({ ...newProduct, stock: e.target.value })} placeholder="0"
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-4 focus:ring-amber-500/10 transition-all" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Foto Produk</label>
                  <div onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
                    className={cn("relative h-32 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center gap-2 bg-slate-50 cursor-pointer",
                      dragActive ? "border-amber-500 bg-amber-50/50" : "border-slate-200",
                      newProduct.image ? "border-transparent" : "hover:border-slate-300"
                    )} onClick={() => document.getElementById('cw-file-input')?.click()}
                  >
                    {newProduct.image ? (
                      <>
                        <img src={newProduct.image} className="absolute inset-0 w-full h-full object-cover rounded-2xl" />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity rounded-2xl">
                          <p className="text-white text-xs font-bold">Ganti Foto</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <Upload size={20} className="text-slate-400" />
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Drag & Drop atau Klik</p>
                      </>
                    )}
                    <input id="cw-file-input" type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest">Batal</button>
                  <button type="submit" className="flex-[2] py-4 bg-amber-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-amber-100 hover:bg-amber-700 transition-all">Simpan Menu</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* EDIT MODAL */}
      <AnimatePresence>
        {editingProduct && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setEditingProduct(null)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl p-8"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Edit Menu</h3>
                  <p className="text-xs text-slate-500 font-medium">Perbarui detail produk Coworking.</p>
                </div>
                <button onClick={() => setEditingProduct(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X size={24} className="text-slate-400" />
                </button>
              </div>
              <form onSubmit={handleUpdateProduct} className="space-y-5">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Nama</label>
                  <input required type="text" value={editingProduct.name} onChange={e => setEditingProduct({ ...editingProduct, name: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-4 focus:ring-amber-500/10" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Deskripsi</label>
                  <textarea value={editingProduct.description || ''} onChange={e => setEditingProduct({ ...editingProduct, description: e.target.value })} placeholder="Masukkan deskripsi singkat..." rows={2}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-4 focus:ring-amber-500/10 resize-none" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Kategori</label>
                    <select value={editingProduct.category} onChange={e => setEditingProduct({ ...editingProduct, category: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-4 focus:ring-amber-500/10">
                      <option value="Ready Meal">Ready Meal</option>
                      <option value="Makanan Ringan">Makanan Ringan</option>
                      <option value="Es Krim">Es Krim</option>
                      <option value="Minuman Siap Saji">Minuman Siap Saji</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Harga</label>
                    <input required type="number" value={editingProduct.price} onChange={e => setEditingProduct({ ...editingProduct, price: parseInt(e.target.value) || 0 })}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-4 focus:ring-amber-500/10" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Stok</label>
                  <input required type="number" value={editingProduct.stock} onChange={e => setEditingProduct({ ...editingProduct, stock: parseInt(e.target.value) || 0 })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-4 focus:ring-amber-500/10" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Foto Produk</label>
                  <div onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={(e) => handleDrop(e, true)}
                    className={cn("relative h-32 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center gap-2 bg-slate-50 cursor-pointer mb-2",
                      dragActive ? "border-amber-500 bg-amber-50/50" : "border-slate-200",
                      editingProduct.image ? "border-transparent" : "hover:border-slate-300"
                    )} onClick={() => document.getElementById('cw-edit-file-input')?.click()}
                  >
                    {editingProduct.image ? (
                      <>
                        <img src={editingProduct.image} className="absolute inset-0 w-full h-full object-cover rounded-2xl" />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity rounded-2xl">
                          <p className="text-white text-xs font-bold">Ganti Foto</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <Upload size={20} className="text-slate-400" />
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Drag & Drop atau Klik</p>
                      </>
                    )}
                    <input id="cw-edit-file-input" type="file" accept="image/*" onChange={(e) => handleFileChange(e, true)} className="hidden" />
                  </div>
                  <input type="text" value={editingProduct.image} onChange={e => setEditingProduct({ ...editingProduct, image: e.target.value })} placeholder="Atau masukkan URL Gambar..."
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-xs focus:outline-none focus:ring-4 focus:ring-amber-500/10" />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setEditingProduct(null)} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest">Batal</button>
                  <button type="submit" className="flex-[2] py-4 bg-amber-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-amber-100 hover:bg-amber-700 transition-all">Simpan Perubahan</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DELETE CONFIRM MODAL */}
      <AnimatePresence>
        {deleteConfirm && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDeleteConfirm(null)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
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
                <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-3.5 bg-slate-100 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest">Batal</button>
                <button onClick={() => handleDelete(deleteConfirm)} className="flex-[2] py-3.5 bg-rose-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-rose-700 transition-all">Ya, Hapus</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
