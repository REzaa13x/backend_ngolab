import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Package, 
  Search, 
  Filter, 
  CheckCircle2, 
  XCircle,
  Clock,
  Hand,
  Volume2,
  Zap,
  Upload,
  Image as ImageIcon,
  RefreshCcw,
  Trash2
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
  description?: string;
}

interface Point {
  x: number;
  y: number;
}

interface Ingredient {
  id: string;
  name: string;
  unit: string;
  stock: number;
  minStock: number;
}

interface PortionYield {
  name: string;
  yield: number;
}

export default function StockManagement() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [portionYields, setPortionYields] = useState<PortionYield[]>([]);
  const [activeTab, setActiveTab] = useState<'products' | 'ingredients'>('products');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isRestockModalOpen, setIsRestockModalOpen] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState<Ingredient | null>(null);
  const [restockAmount, setRestockAmount] = useState('');
  const [editingProduct, setEditingProduct] = useState<MenuItem | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<MenuItem | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const fetchIngredients = async () => {
    try {
      const [ingRes, yieldRes] = await Promise.all([
        fetch('/api/ingredients'),
        fetch('/api/ingredients/yield')
      ]);
      setIngredients(await ingRes.json());
      setPortionYields(await yieldRes.json());
    } catch (err) {
      console.error("Failed to fetch ingredients:", err);
    }
  };

  const handleRestock = async () => {
    if (!selectedIngredient || !restockAmount) return;
    try {
      const res = await fetch(`/api/ingredients/${selectedIngredient.id}/restock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: restockAmount })
      });
      if (res.ok) {
        setIsRestockModalOpen(false);
        setRestockAmount('');
        fetchIngredients();
        playBeep(1500, 0.2);
      }
    } catch (err) {
      console.error("Restock failed:", err);
    }
  };
  const [newProduct, setNewProduct] = useState({
    name: '',
    category: 'Main Course',
    price: '',
    stock: '',
    image: '',
    description: ''
  });
  
  const [dragActive, setDragActive] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("File too besar. Maksimal 5MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewProduct({ ...newProduct, image: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewProduct({ ...newProduct, image: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const audioContextRef = useRef<AudioContext | null>(null);

  // Fetch menu on mount
  const fetchMenu = useCallback(async () => {
    try {
      const url = selectedCategory === 'Semua' 
        ? '/api/menu?outlet=ngolab' 
        : `/api/menu?outlet=ngolab&category=${encodeURIComponent(selectedCategory)}`;
      const res = await fetch(url);
      const data = await res.json();
      setMenuItems(data);
      fetchIngredients();
      setLoading(false);
    } catch (err) {
      console.error("Failed to fetch menu:", err);
    }
  }, [selectedCategory]);

  useEffect(() => {
    fetchMenu();
  }, [fetchMenu]);

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProduct)
      });
      if (res.ok) {
        setIsAddModalOpen(false);
        setNewProduct({ name: '', category: 'Main Course', price: '', stock: '', image: '', description: '' });
        fetchMenu();
        playBeep(1000, 0.2);
      }
    } catch (err) {
      console.error("Failed to add product:", err);
    }
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
      if (res.ok) {
        setEditingProduct(null);
        fetchMenu();
        playBeep(1200, 0.2);
      }
    } catch (err) {
      console.error("Failed to update product:", err);
    }
  };

  const handleSyncSmartTag = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/menu/sync-smart-tag', { method: 'POST' });
      if (res.ok) {
        const result = await res.json();
        alert(result.message);
        fetchMenu();
        playBeep(1500, 0.3);
      } else {
        alert("Gagal sinkronisasi data.");
      }
    } catch (err) {
      console.error("Failed to sync:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteProduct = async (item: MenuItem) => {
    try {
      const res = await fetch(`/api/menu/${item.id}`, { method: 'DELETE' });
      if (res.ok) {
        setDeleteConfirm(null);
        fetchMenu();
        playBeep(600, 0.15);
      } else {
        alert("Gagal menghapus menu.");
      }
    } catch (err) {
      console.error("Failed to delete:", err);
      alert("Terjadi kesalahan saat menghapus menu.");
    }
  };

  // Audio Feedback Implementation
  const playBeep = (freq: number = 880, duration: number = 0.1) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const ctx = audioContextRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + duration);
  };

  const toggleStock = async (id: string | number) => {
    try {
      const res = await fetch(`/api/menu/${id}/toggle-stock`, { method: 'PATCH' });
      if (res.ok) {
        const result = await res.json();
        setMenuItems(prev => prev.map(item => item.id === id ? result.item : item));
        
        // Success Feedback
        playBeep(result.item.inStock ? 1200 : 600, 0.15);
      } else {
        const errorData = await res.json().catch(() => ({}));
        alert(errorData.message || "Gagal mengubah status menu.");
      }
    } catch (err) {
      console.error("Failed to toggle stock:", err);
      alert("Terjadi kesalahan koneksi saat merubah status menu.");
    }
  };



  const filteredMenu = menuItems.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 pb-32 relative">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 leading-tight">Katalog Menu Ngolab</h2>
          <p className="text-sm text-slate-500 font-medium tracking-tight mt-1">
            Tampilan katalog produk Ngolab. Untuk menambah, mengubah, atau menghapus menu — gunakan halaman <span className="font-bold text-indigo-600">Manajemen Menu</span>.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
            <button 
              onClick={() => setActiveTab('products')}
              className={cn(
                "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                activeTab === 'products' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
              )}
            >
              Produk Jadi
            </button>
            <button 
              onClick={() => setActiveTab('ingredients')}
              className={cn(
                "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                activeTab === 'ingredients' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
              )}
            >
              Bahan Baku
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'products' ? (
        <>
          {/* Toolbar */}
          <div className="flex flex-col xl:flex-row items-center gap-4">
            <div className="relative flex-1 group w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
              <input 
                type="text" 
                placeholder="Cari nama menu..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-white border border-slate-100 rounded-2xl pl-12 pr-4 py-3.5 text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium"
              />
            </div>
            
            <div className="flex items-center gap-2 p-1 bg-white border border-slate-100 rounded-2xl overflow-x-auto w-full xl:w-auto scrollbar-hide">
              {['Semua', 'Main Course', 'Beverage', 'Snack'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={cn(
                    "px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all",
                    selectedCategory === cat 
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-200" 
                      : "text-slate-500 hover:bg-slate-50"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>

            <button 
              onClick={handleSyncSmartTag}
              disabled={isSyncing}
              className="bg-emerald-600 text-white px-5 py-3.5 rounded-2xl hover:bg-emerald-700 transition-all font-bold text-xs shadow-lg shadow-emerald-200 flex items-center gap-2 whitespace-nowrap disabled:opacity-50"
            >
              <RefreshCcw size={18} className={cn(isSyncing && "animate-spin")} />
              {isSyncing ? "Menyelaraskan..." : "Sync Smart Tag"}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredMenu.map((item) => (
              <motion.div
                key={item.id}
                layout
                className={cn(
                  "relative bg-white rounded-[2rem] border-2 transition-all duration-300 overflow-hidden group p-2",
                  "border-slate-100 shadow-premium hover:border-indigo-500/50"
                )}
              >
                {/* Stock Toggle Visual Helper */}
                <div className="relative aspect-video rounded-[1.5rem] overflow-hidden mb-2">
                  <img 
                    src={item.image} 
                    alt={item.name} 
                    className={cn(
                      "w-full h-full object-cover transition-transform duration-700 group-hover:scale-110",
                      !item.inStock && "grayscale opacity-40"
                    )}
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&q=80`;
                    }}
                  />
                  
                  {/* Overlay Status */}
                  <div className={cn(
                    "absolute inset-0 flex flex-col items-center justify-center transition-opacity duration-300 pointer-events-none",
                    !item.inStock ? "bg-slate-900/40 opacity-100" : "opacity-0"
                  )}>
                    {!item.inStock && (
                      <div className="bg-white/90 backdrop-blur-md p-4 rounded-3xl shadow-xl transform scale-110">
                        <XCircle size={32} className="text-rose-500" />
                      </div>
                    )}
                  </div>


                </div>

                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex-1 min-w-0">
                        <span className="inline-block px-2 py-0.5 rounded bg-indigo-50 text-indigo-600 text-[9px] font-black uppercase tracking-widest mb-1.5">
                          {item.category}
                        </span>
                        <h3 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-2 leading-tight">
                          {item.name}
                        </h3>
                        {item.description && (
                          <p className="text-[11px] text-slate-400 font-medium mt-1 line-clamp-2 leading-snug">
                            {item.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Yield Info Badge */}
                    {portionYields.find(y => y.name === item.name) && (
                      <div className="mb-3 flex items-center gap-2 py-1.5 px-3 bg-amber-50 rounded-lg border border-amber-100">
                         <Zap size={10} className="text-amber-600" />
                         <span className="text-[10px] font-bold text-amber-900 uppercase">
                           Estimasi Portions: {portionYields.find(y => y.name === item.name)?.yield} Porsi
                         </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                      <p className="text-[13px] font-black text-indigo-600 whitespace-nowrap">
                        Rp {item.price.toLocaleString()}
                      </p>
                      <div className={cn(
                        "inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest transition-colors",
                        item.inStock ? "text-emerald-600 bg-emerald-50" : "text-rose-600 bg-rose-50"
                      )}>
                        {item.inStock ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                        {item.inStock ? 'Tersedia' : 'Habis'}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-5">
                    <button 
                      onClick={() => toggleStock(item.id)}
                      className={cn(
                        "w-full py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-md",
                        item.inStock 
                          ? "bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-100 shadow-rose-100/50" 
                          : "bg-indigo-600 text-white shadow-indigo-100/50 hover:bg-indigo-700"
                      )}
                    >
                      {item.inStock ? 'Nonaktifkan' : 'Aktifkan'}
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
             {/* Ingredient List */}
             <div className="lg:col-span-2 bg-white rounded-[2.5rem] border border-slate-100 shadow-xl overflow-hidden">
                <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                   <div>
                      <h3 className="text-xl font-bold text-slate-900">Gudang Bahan Baku</h3>
                      <p className="text-xs text-slate-500 font-medium">Monitoring stok mentah untuk komposisi resep.</p>
                   </div>
                </div>
                <div className="overflow-x-auto">
                   <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50/50 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-50">
                           <th className="px-8 py-5">Nama Bahan</th>
                           <th className="px-8 py-5">Stok Saat Ini</th>
                           <th className="px-8 py-5">Satuan</th>
                           <th className="px-8 py-5">Status</th>
                           <th className="px-8 py-5 text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {ingredients.map(ing => (
                          <tr key={ing.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-8 py-5">
                               <p className="text-sm font-bold text-slate-900">{ing.name}</p>
                               <p className="text-[10px] text-slate-400 uppercase font-bold tracking-tighter">ID: {ing.id}</p>
                            </td>
                            <td className="px-8 py-5">
                               <p className={cn(
                                 "text-sm font-black font-mono",
                                 ing.stock <= ing.minStock ? "text-rose-600" : "text-indigo-600"
                               )}>{ing.stock}</p>
                            </td>
                            <td className="px-8 py-5">
                               <span className="text-xs font-bold text-slate-500">{ing.unit}</span>
                            </td>
                            <td className="px-8 py-5">
                               {ing.stock <= ing.minStock ? (
                                 <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-rose-50 text-rose-600 rounded-md text-[9px] font-black uppercase tracking-widest">
                                   <Zap size={10} /> Stok Rendah
                                 </div>
                               ) : (
                                 <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-emerald-50 text-emerald-600 rounded-md text-[9px] font-black uppercase tracking-widest">
                                   <CheckCircle2 size={10} /> Aman
                                 </div>
                               )}
                            </td>
                            <td className="px-8 py-5 text-right">
                               <button 
                                 onClick={() => {
                                   setSelectedIngredient(ing);
                                   setIsRestockModalOpen(true);
                                 }}
                                 className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-sm"
                               >
                                  Restock
                               </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                   </table>
                </div>
             </div>

             {/* Yield Summary Card */}
             <div className="bg-indigo-600 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl" />
                <div className="relative z-10">
                   <h3 className="text-xl font-bold mb-2">Simulasi Yield Menu</h3>
                   <p className="text-xs text-indigo-100 font-medium opacity-80 mb-8 border-b border-white/20 pb-4">
                     Porsi yang dapat dihasilkan berdasarkan stok bahan baku yang tersedia saat ini.
                   </p>

                   <div className="space-y-6">
                      {portionYields.map((py, idx) => (
                        <div key={idx} className="flex items-center justify-between group">
                           <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-black border border-white/10 group-hover:bg-white group-hover:text-indigo-600 transition-all">
                                 {py.yield}
                              </div>
                              <span className="text-sm font-bold truncate max-w-[150px]">{py.name}</span>
                           </div>
                           <div className="text-right">
                              <p className="text-[10px] font-bold text-indigo-100 uppercase tracking-widest mb-1">Status</p>
                              <p className={cn(
                                "text-xs font-black",
                                py.yield < 10 ? "text-amber-300" : "text-emerald-300"
                              )}>
                                {py.yield < 10 ? 'Kritis' : 'Opsi Cukup'}
                              </p>
                           </div>
                        </div>
                      ))}
                   </div>

                   <button className="w-full mt-12 py-4 bg-white text-indigo-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-50 transition-all shadow-xl">
                      Download Laporan Stok
                   </button>
                </div>
             </div>
          </div>
        </div>
      )}

      {/* Restock Modal */}
      <AnimatePresence>
        {isRestockModalOpen && selectedIngredient && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsRestockModalOpen(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-white rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl">
               <h3 className="text-xl font-bold text-slate-900 mb-2">Restock {selectedIngredient.name}</h3>
               <p className="text-xs text-slate-500 font-medium mb-6 uppercase tracking-widest">Satuan: {selectedIngredient.unit}</p>

               <div className="space-y-4">
                  <div>
                     <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block">Jumlah Tambahan</label>
                     <input 
                       type="number"
                       value={restockAmount}
                       onChange={e => setRestockAmount(e.target.value)}
                       className="w-full bg-slate-50 border-none rounded-2xl p-4 font-bold text-indigo-600 focus:ring-2 focus:ring-indigo-500 outline-none"
                       placeholder="Masukkan angka..."
                     />
                  </div>
                  <div className="flex gap-3 pt-4">
                     <button onClick={() => setIsRestockModalOpen(false)} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest">Batal</button>
                     <button onClick={handleRestock} className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-100">Simpan Stok</button>
                  </div>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>



      {/* MODAL TAMBAH PRODUK */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl p-8 overflow-hidden"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Tambah Produk Baru</h3>
                  <p className="text-xs text-slate-500 font-medium">Lengkapi data produk makanan atau minuman.</p>
                </div>
                <button 
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <XCircle size={24} className="text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleAddProduct} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Nama Produk</label>
                    <input 
                      required
                      type="text" 
                      value={newProduct.name}
                      onChange={e => setNewProduct({...newProduct, name: e.target.value})}
                      placeholder="Contoh: Nasi Goreng Gila"
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all font-bold"
                    />
                  </div>
                  
                  <div className="col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Deskripsi Produk</label>
                    <textarea 
                      value={newProduct.description}
                      onChange={e => setNewProduct({...newProduct, description: e.target.value})}
                      placeholder="Masukkan deskripsi singkat..."
                      rows={2}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all resize-none"
                    />
                  </div>
                  
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Kategori</label>
                    <select 
                      value={newProduct.category}
                      onChange={e => setNewProduct({...newProduct, category: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                    >
                      <option value="Main Course">Main Course</option>
                      <option value="Beverage">Beverage</option>
                      <option value="Snack">Snack</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Harga (Rp)</label>
                    <input 
                      required
                      type="number" 
                      value={newProduct.price}
                      onChange={e => setNewProduct({...newProduct, price: e.target.value})}
                      placeholder="0"
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Stok Awal</label>
                    <input 
                      required
                      type="number" 
                      value={newProduct.stock}
                      onChange={e => setNewProduct({...newProduct, stock: e.target.value})}
                      placeholder="0"
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Foto Produk</label>
                    <div 
                      onDragEnter={handleDrag}
                      onDragLeave={handleDrag}
                      onDragOver={handleDrag}
                      onDrop={handleDrop}
                      className={cn(
                        "relative h-40 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center gap-2 overflow-hidden bg-slate-50",
                        dragActive ? "border-indigo-500 bg-indigo-50/50" : "border-slate-200",
                        newProduct.image ? "border-transparent" : "hover:border-slate-300"
                      )}
                    >
                      {newProduct.image ? (
                        <>
                          <img src={newProduct.image} className="absolute inset-0 w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                            <button 
                              type="button"
                              onClick={() => setNewProduct({...newProduct, image: ''})}
                              className="bg-white/20 backdrop-blur-md p-2 rounded-full text-white"
                            >
                              <XCircle size={20} />
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="p-3 bg-white rounded-full shadow-sm text-slate-400">
                            <Upload size={20} />
                          </div>
                          <div className="text-center">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Klik atau seret gambar</p>
                            <p className="text-[9px] text-slate-400 font-medium mt-1">PNG, JPG up to 5MB</p>
                          </div>
                          <input 
                            type="file" 
                            accept="image/*"
                            onChange={handleFileChange}
                            className="absolute inset-0 opacity-0 cursor-pointer"
                          />
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="flex-1 py-4 rounded-2xl text-sm font-bold text-slate-500 hover:bg-slate-50 transition-all"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit"
                    className="flex-[2] py-4 rounded-2xl bg-indigo-600 text-white text-sm font-bold shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all"
                  >
                    Simpan Produk
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL EDIT PRODUK */}
      <AnimatePresence>
        {editingProduct && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingProduct(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl p-8 overflow-hidden"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Ubah Data Produk</h3>
                  <p className="text-xs text-slate-500 font-medium">Perbarui informasi produk yang sudah ada.</p>
                </div>
                <button 
                  onClick={() => setEditingProduct(null)}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <XCircle size={24} className="text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleUpdateProduct} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Nama Produk</label>
                    <input 
                      required
                      type="text" 
                      value={editingProduct.name}
                      onChange={e => setEditingProduct({...editingProduct, name: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all font-bold"
                    />
                  </div>
                  
                  <div className="col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Deskripsi</label>
                    <textarea 
                      value={editingProduct.description || ''}
                      onChange={e => setEditingProduct({...editingProduct, description: e.target.value})}
                      placeholder="Masukkan deskripsi singkat..."
                      rows={2}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all resize-none"
                    />
                  </div>
                  
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Kategori</label>
                    <select 
                      value={editingProduct.category}
                      onChange={e => setEditingProduct({...editingProduct, category: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all font-bold"
                    >
                      <option value="Main Course">Main Course</option>
                      <option value="Beverage">Beverage</option>
                      <option value="Snack">Snack</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Harga (Rp)</label>
                    <input 
                      required
                      type="number" 
                      value={editingProduct.price}
                      onChange={e => setEditingProduct({...editingProduct, price: parseInt(e.target.value)})}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Stok</label>
                    <input 
                      required
                      type="number" 
                      value={editingProduct.stock}
                      onChange={e => setEditingProduct({...editingProduct, stock: parseInt(e.target.value)})}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all font-bold"
                    />
                  </div>
                  
                  <div className="col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Ubah Foto</label>
                    <div 
                      className="relative h-32 rounded-2xl border-2 border-dashed border-slate-200 transition-all flex flex-col items-center justify-center gap-2 overflow-hidden bg-slate-50 hover:border-slate-300"
                    >
                      {editingProduct.image ? (
                        <>
                          <img src={editingProduct.image} className="absolute inset-0 w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                            <input 
                              type="file" 
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onloadend = () => setEditingProduct({...editingProduct, image: reader.result as string});
                                  reader.readAsDataURL(file);
                                }
                              }}
                              className="absolute inset-0 opacity-0 cursor-pointer"
                            />
                            <Upload size={20} className="text-white" />
                          </div>
                        </>
                      ) : (
                        <div className="text-center p-4">
                          <Upload size={20} className="mx-auto text-slate-400 mb-2" />
                          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Klik untuk ganti foto</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setEditingProduct(null)}
                    className="flex-1 py-4 rounded-2xl text-sm font-bold text-slate-500 hover:bg-slate-50 transition-all"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit"
                    className="flex-[2] py-4 rounded-2xl bg-indigo-600 text-white text-sm font-bold shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all"
                  >
                    Simpan Perubahan
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Audio Indicator */}
      <div className="fixed bottom-8 right-8 p-3 bg-white border border-slate-100 rounded-2xl shadow-xl flex items-center gap-3">
        <Volume2 size={16} className="text-slate-400" />
        <span className="text-[10px] font-bold text-slate-900 uppercase tracking-widest">Audio Aktif</span>
      </div>

      {/* DELETE CONFIRM MODAL */}
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
                <span className="font-bold text-slate-900">"{deleteConfirm.name}"</span> akan dihapus secara permanen dari Katalog Ngolab.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 py-3.5 bg-slate-100 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest"
                >
                  Batal
                </button>
                <button
                  onClick={() => handleDeleteProduct(deleteConfirm)}
                  className="flex-[2] py-3.5 bg-rose-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-rose-700 transition-all"
                >
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
