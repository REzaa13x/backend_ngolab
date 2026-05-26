import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  ShoppingBag,
  Plus,
  Minus,
  User,
  Check,
  RefreshCw,
  Coffee,
  Package
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '@/src/lib/utils';

export default function ManualOrder() {
  const [manualCustomerName, setManualCustomerName] = useState('');
  const [selectedItems, setSelectedItems] = useState<{ id: number, quantity: number }[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [searchMenu, setSearchMenu] = useState('');
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedOutlet, setSelectedOutlet] = useState<'ngolab' | 'coworking'>('ngolab');
  const [paymentMethod, setPaymentMethod] = useState('Tunai');
  const [paymentStatus, setPaymentStatus] = useState<'belum_bayar' | 'lunas'>('belum_bayar');

  useEffect(() => {
    fetchMenu();
  }, [selectedOutlet]);

  const fetchMenu = () => {
    fetch(`/api/menu?outlet=${selectedOutlet}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setMenuItems(data);
      })
      .catch(err => console.error("Menu fetch failed:", err));
  };

  const filteredMenu = useMemo(() => {
    if (!Array.isArray(menuItems)) return [];
    return menuItems.filter(m => 
      (m.name || '').toLowerCase().includes(searchMenu.toLowerCase()) || 
      (m.category || '').toLowerCase().includes(searchMenu.toLowerCase())
    );
  }, [menuItems, searchMenu]);

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

  const submitManualOrder = async () => {
    if (!manualCustomerName || selectedItems.length === 0) return;
    setManualSubmitting(true);
    setErrorMessage('');
    try {
      // Build full item payload with name and price resolved from menuItems
      const itemsPayload = selectedItems.map(cartItem => {
        const menu = menuItems.find(m => m.id === cartItem.id);
        return {
          id: cartItem.id,
          name: menu?.name || 'Unknown',
          price: menu?.price || 0,
          quantity: cartItem.quantity
        };
      });

      const res = await fetch('/api/orders/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: manualCustomerName,
          items: itemsPayload,
          payment_method: paymentMethod,
          payment_status: paymentStatus,
          source: selectedOutlet
        })
      });

      const data = await res.json();

      if (res.ok) {
        setManualCustomerName('');
        setSelectedItems([]);
        setPaymentMethod('Tunai');
        setPaymentStatus('belum_bayar');
        setSuccessMessage(`Pesanan berhasil dibuat! Invoice: ${data.invoice_number}`);
        setTimeout(() => setSuccessMessage(''), 5000);
      } else {
        setErrorMessage(data.message || 'Gagal membuat pesanan');
      }
    } catch (err) {
      console.error("Manual order failed:", err);
      setErrorMessage('Gagal terhubung ke server');
    } finally {
      setManualSubmitting(false);
    }
  };

  const handleOutletChange = (outlet: 'ngolab' | 'coworking') => {
    setSelectedOutlet(outlet);
    setSelectedItems([]);
    setSearchMenu('');
  };

  return (
    <div className="h-full flex flex-col space-y-6 animate-in fade-in duration-500">
      <div>
        <h2 className="text-2xl font-black tracking-tight text-slate-900">Pesanan Manual</h2>
        <p className="text-sm text-slate-500 font-medium tracking-tight">Input pesanan via Telepon atau Walk-in langsung ke sistem.</p>
      </div>

      {/* Outlet Toggle */}
      <div className="flex items-center gap-2 p-1.5 bg-white border border-slate-100 rounded-2xl w-fit shadow-sm">
        <button
          onClick={() => handleOutletChange('ngolab')}
          className={cn(
            "flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-bold transition-all",
            selectedOutlet === 'ngolab'
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
              : "text-slate-500 hover:bg-slate-50"
          )}
        >
          <Package size={16} />
          Menu Ngolab
        </button>
        <button
          onClick={() => handleOutletChange('coworking')}
          className={cn(
            "flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-bold transition-all",
            selectedOutlet === 'coworking'
              ? "bg-amber-600 text-white shadow-md shadow-amber-200"
              : "text-slate-500 hover:bg-slate-50"
          )}
        >
          <Coffee size={16} />
          Menu Coworking
        </button>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-6 overflow-hidden">
        {/* Left Side: Product Selector */}
        <div className="flex-[3] flex flex-col bg-white rounded-3xl border border-slate-100 shadow-premium overflow-hidden">
          <div className="p-6 border-b border-slate-50 bg-slate-50/30">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder={`Cari Menu ${selectedOutlet === 'ngolab' ? 'Ngolab' : 'Coworking'}...`}
                value={searchMenu}
                onChange={(e) => setSearchMenu(e.target.value)}
                className="w-full bg-white border border-slate-100 rounded-2xl pl-12 pr-4 py-4 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-sm"
              />
            </div>
            <div className={cn(
              "mt-3 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg inline-flex items-center gap-2",
              selectedOutlet === 'ngolab' ? "bg-indigo-50 text-indigo-600" : "bg-amber-50 text-amber-700"
            )}>
              {selectedOutlet === 'ngolab' ? <Package size={12} /> : <Coffee size={12} />}
              {selectedOutlet === 'ngolab' ? 'Outlet Ngolab' : 'Outlet Coworking'} — {filteredMenu.length} item
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredMenu.map((item) => (
                <div 
                  key={item.id}
                  className={cn(
                    "group bg-white border p-4 rounded-3xl hover:shadow-xl transition-all cursor-pointer relative flex flex-col",
                    selectedOutlet === 'ngolab'
                      ? "border-slate-100 hover:border-indigo-600 hover:shadow-indigo-50/50"
                      : "border-slate-100 hover:border-amber-500 hover:shadow-amber-50/50"
                  )}
                  onClick={() => addToManualOrder(item.id)}
                >
                  <div className="flex items-center gap-4 mb-4">
                    <img src={item.image} className="w-16 h-16 rounded-2xl object-cover shadow-sm border border-slate-50" referrerPolicy="no-referrer" />
                    <div className="flex-1">
                      <span className={cn(
                        "text-[10px] font-black uppercase tracking-widest mb-1 block",
                        selectedOutlet === 'ngolab' ? "text-indigo-600" : "text-amber-700"
                      )}>{item.category}</span>
                      <h4 className="text-xs font-black text-slate-900 line-clamp-2 leading-tight">{item.name}</h4>
                    </div>
                  </div>
                  <div className="mt-auto flex items-center justify-between">
                    <p className="text-sm font-black text-slate-900">Rp {(item.price || 0).toLocaleString()}</p>
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity",
                      selectedOutlet === 'ngolab' ? "bg-indigo-50 text-indigo-600" : "bg-amber-50 text-amber-600"
                    )}>
                      <Plus size={16} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side: Cart Summary */}
        <div className="flex-[2] flex flex-col bg-slate-50 rounded-3xl border border-slate-100 shadow-inner overflow-hidden">
          <div className="p-6 border-b border-slate-200 bg-white space-y-4">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 block">Identitas Pelanggan</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  type="text" 
                  placeholder="Nama Pelanggan / No. Telp"
                  value={manualCustomerName}
                  onChange={(e) => setManualCustomerName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-4 text-xs font-black text-slate-900 focus:outline-none focus:border-indigo-600 focus:bg-white transition-all shadow-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 block">Metode Bayar</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600 focus:bg-white transition-all"
                >
                  <option value="Tunai">Tunai</option>
                  <option value="QRIS">QRIS</option>
                  <option value="Transfer">Transfer Bank</option>
                  <option value="Debit">Kartu Debit</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 block">Status Bayar</label>
                <select
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value as 'belum_bayar' | 'lunas')}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600 focus:bg-white transition-all"
                >
                  <option value="belum_bayar">Belum Bayar</option>
                  <option value="lunas">Lunas</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
              <span className="text-[10px] font-black text-slate-400 uppercase">Keranjang Pesanan</span>
              <span className={cn(
                "text-[10px] font-black px-2 py-1 rounded-md",
                selectedOutlet === 'ngolab' ? "text-indigo-600 bg-indigo-50" : "text-amber-700 bg-amber-50"
              )}>{selectedItems.length} Item</span>
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
                    <motion.div 
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      key={cartItem.id} 
                      className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between group"
                    >
                      <div className="flex-1 pr-2">
                        <h5 className="text-[11px] font-black text-slate-900 leading-tight">{menu.name}</h5>
                        <span className={cn(
                          "text-[10px] font-bold",
                          selectedOutlet === 'ngolab' ? "text-indigo-600" : "text-amber-700"
                        )}>Rp {((menu.price || 0) * cartItem.quantity).toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-100 shrink-0">
                        <button 
                          onClick={() => removeFromManualOrder(menu.id)}
                          className="p-1 text-slate-400 hover:text-rose-500 hover:bg-white rounded-lg transition-all"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="text-[11px] font-black text-slate-900 w-4 text-center">{cartItem.quantity}</span>
                        <button 
                          onClick={() => addToManualOrder(menu.id)}
                          className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-all"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="p-6 bg-white border-t border-slate-200">
            <div className="flex justify-between items-center mb-4">
              <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Total Bayar:</span>
              <span className="text-2xl font-black text-slate-900">Rp {manualOrderTotal.toLocaleString()}</span>
            </div>

            {successMessage && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 p-3 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-xl text-xs font-bold text-center flex items-center justify-center gap-2"
              >
                <Check size={16} /> {successMessage}
              </motion.div>
            )}

            {errorMessage && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 p-3 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl text-xs font-bold text-center"
              >
                ⚠️ {errorMessage}
              </motion.div>
            )}

            <button 
              disabled={!manualCustomerName || selectedItems.length === 0 || manualSubmitting}
              onClick={submitManualOrder}
              className="w-full py-5 bg-slate-900 text-white rounded-[1.5rem] text-sm font-black uppercase tracking-[0.2em] hover:bg-black transition-all shadow-xl shadow-slate-200 flex items-center justify-center gap-3 disabled:opacity-50 disabled:shadow-none"
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
    </div>
  );
}
