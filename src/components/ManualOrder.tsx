import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  Search, 
  ShoppingBag,
  Plus,
  Minus,
  User,
  Check,
  RefreshCw,
  Coffee,
  Package,
  ReceiptText,
  Trash2,
  Banknote,
  CreditCard
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '@/src/lib/utils';

export default function ManualOrder() {
  const { user } = useAuth();
  const [manualCustomerName, setManualCustomerName] = useState('');
  const [selectedItems, setSelectedItems] = useState<{ id: string | number, quantity: number }[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [searchMenu, setSearchMenu] = useState('');
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedOutlet, setSelectedOutlet] = useState<'ngolab' | 'coworking'>('ngolab');
  const [paymentMethod, setPaymentMethod] = useState('Tunai');
  const [paymentStatus, setPaymentStatus] = useState<'belum_bayar' | 'lunas'>('belum_bayar');
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  const [orderMode, setOrderMode] = useState<'regular' | 'preorder'>('regular');
  const [preorderCampaigns, setPreorderCampaigns] = useState<any[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [paymentTiming, setPaymentTiming] = useState<'before_pickup' | 'on_pickup'>('before_pickup');

  useEffect(() => {
    let active = true;
    const url = orderMode === 'regular'
      ? `/api/menu?outlet=${selectedOutlet}`
      : `/api/preorders/active?outlet=${selectedOutlet}`;
    fetch(url)
      .then(res => res.json())
      .then(data => {
        if (!active || !Array.isArray(data)) return;
        if (orderMode === 'regular') {
          setPreorderCampaigns([]);
          setSelectedCampaignId('');
          setMenuItems(data);
        } else {
          setPreorderCampaigns(data);
          const campaign = data[0];
          setSelectedCampaignId(campaign?.id || '');
          setMenuItems((campaign?.items || []).map((item: any) => ({
            ...item,
            image: item.image_url,
            stock: item.remaining_quota,
            campaignId: campaign.id,
            preorder: true
          })));
        }
      })
      .catch(err => console.error("Menu fetch failed:", err));

    return () => {
      active = false;
    };
  }, [selectedOutlet, orderMode]);

  const chooseCampaign = (campaignId: string) => {
    const campaign = preorderCampaigns.find(item => item.id === campaignId);
    setSelectedCampaignId(campaignId);
    setSelectedItems([]);
    setSelectedCategory('Semua');
    setMenuItems((campaign?.items || []).map((item: any) => ({
      ...item,
      image: item.image_url,
      stock: item.remaining_quota,
      campaignId: campaign.id,
      preorder: true
    })));
  };

  const filteredMenu = useMemo(() => {
    if (!Array.isArray(menuItems)) return [];
    return menuItems.filter(m => {
      const matchesSearch =
        (m.name || '').toLowerCase().includes(searchMenu.toLowerCase()) ||
        (m.category || '').toLowerCase().includes(searchMenu.toLowerCase());
      const matchesCategory = selectedCategory === 'Semua' || m.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [menuItems, searchMenu, selectedCategory]);

  const categories = useMemo(() => {
    const values = menuItems
      .map(item => item.category)
      .filter((category): category is string => Boolean(category));
    return ['Semua', ...Array.from(new Set(values))];
  }, [menuItems]);

  const addToManualOrder = (id: string | number) => {
    setSelectedItems(prev => {
      const existing = prev.find(i => i.id.toString() === id.toString());
      if (existing) {
        return prev.map(i => i.id.toString() === id.toString() ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { id, quantity: 1 }];
    });
  };

  const removeFromManualOrder = (id: string | number) => {
    setSelectedItems(prev => {
      const existing = prev.find(i => i.id.toString() === id.toString());
      if (existing && existing.quantity > 1) {
        return prev.map(i => i.id.toString() === id.toString() ? { ...i, quantity: i.quantity - 1 } : i);
      }
      return prev.filter(i => i.id.toString() !== id.toString());
    });
  };

  const manualOrderTotal = useMemo(() => {
    return selectedItems.reduce((acc, curr) => {
      const item = menuItems.find(m => m.id.toString() === curr.id.toString());
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
        const menu = menuItems.find(m => m.id.toString() === cartItem.id.toString());
        return {
          id: cartItem.id,
          name: menu?.name || 'Unknown',
          price: menu?.price || 0,
          quantity: cartItem.quantity
        };
      });

      const isPreorder = orderMode === 'preorder';
      const endpoint = isPreorder ? `/api/preorders/${selectedCampaignId}/orders` : '/api/orders/manual';
      const payload = isPreorder ? {
        customer_name: manualCustomerName,
        items: selectedItems,
        payment_timing: paymentTiming,
        payment_method: paymentMethod
      } : {
        customer_name: manualCustomerName,
        items: itemsPayload,
        payment_method: paymentMethod,
        payment_status: paymentStatus,
        source: selectedOutlet
      };
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-name': user?.name || 'Kasir'
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (res.ok) {
        setManualCustomerName('');
        setSelectedItems([]);
        setPaymentMethod('Tunai');
        setPaymentStatus('belum_bayar');
        setPaymentTiming('before_pickup');
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
    setSelectedCategory('Semua');
  };

  const handleModeChange = (mode: 'regular' | 'preorder') => {
    setOrderMode(mode);
    setSelectedItems([]);
    setSearchMenu('');
    setSelectedCategory('Semua');
  };

  return (
    <div className="h-full min-h-0 flex flex-col bg-[#f7f7f8] -m-8 animate-in fade-in duration-300">
      <div className="min-h-16 shrink-0 bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shrink-0">
            <ReceiptText size={18} />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-900 leading-tight">Point of Sale</h2>
            <div className="mt-1 flex items-center gap-1">
              <button type="button" onClick={() => handleModeChange('regular')} className={cn('px-2.5 py-1 rounded text-[10px] font-bold', orderMode === 'regular' ? 'bg-primary text-primary-foreground' : 'bg-slate-100 text-slate-500')}>Menu Tetap</button>
              <button type="button" onClick={() => handleModeChange('preorder')} className={cn('px-2.5 py-1 rounded text-[10px] font-bold', orderMode === 'preorder' ? 'bg-primary text-primary-foreground' : 'bg-slate-100 text-slate-500')}>Pre-order</button>
            </div>
          </div>
        </div>

        <div className="flex items-center bg-slate-100 rounded-lg p-1 shrink-0">
          <button
            onClick={() => handleOutletChange('ngolab')}
            className={cn(
              'h-9 px-4 rounded-md text-xs font-semibold flex items-center gap-2 transition-colors',
              selectedOutlet === 'ngolab' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-800'
            )}
          >
            <Package size={15} /> Ngolab
          </button>
          <button
            onClick={() => handleOutletChange('coworking')}
            className={cn(
              'h-9 px-4 rounded-md text-xs font-semibold flex items-center gap-2 transition-colors',
              selectedOutlet === 'coworking' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-800'
            )}
          >
            <Coffee size={15} /> Coworking
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_390px]">
        <section className="min-h-0 flex flex-col border-r border-slate-200">
          <div className="bg-white px-5 py-4 border-b border-slate-200 space-y-3">
            {orderMode === 'preorder' && (
              <div className="flex items-center gap-3">
                <label className="text-xs font-semibold text-slate-600 shrink-0">Program PO</label>
                <select
                  value={selectedCampaignId}
                  onChange={event => chooseCampaign(event.target.value)}
                  className="flex-1 h-10 border border-slate-200 rounded-lg px-3 text-sm bg-white focus:outline-none focus:border-primary"
                >
                  {preorderCampaigns.length === 0 && <option value="">Belum ada PO yang sedang dibuka</option>}
                  {preorderCampaigns.map(campaign => (
                    <option key={campaign.id} value={campaign.id}>
                      {campaign.name} — penyajian {new Date(campaign.service_at).toLocaleString('id-ID')}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
              <input
                type="search"
                placeholder="Cari produk atau kategori..."
                value={searchMenu}
                onChange={(event) => setSearchMenu(event.target.value)}
                className="w-full h-11 bg-slate-50 border border-slate-200 rounded-lg pl-10 pr-4 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
              {categories.map(category => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={cn(
                    'h-8 px-3.5 rounded-md whitespace-nowrap text-xs font-medium border transition-colors',
                    selectedCategory === category
                      ? 'bg-primary border-primary text-primary-foreground'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-primary/50 hover:text-primary'
                  )}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-slate-700">Produk</p>
              <p className="text-xs text-slate-500">{filteredMenu.length} produk tersedia</p>
            </div>

            {filteredMenu.length === 0 ? (
              <div className="h-52 rounded-xl border border-dashed border-slate-300 bg-white flex flex-col items-center justify-center text-center">
                <Search size={28} className="text-slate-300 mb-3" />
                <p className="text-sm font-medium text-slate-600">Produk tidak ditemukan</p>
                <p className="text-xs text-slate-400 mt-1">Coba kata kunci atau kategori lain.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 2xl:grid-cols-4 gap-3">
                {filteredMenu.map(item => {
                  const cartItem = selectedItems.find(selected => selected.id.toString() === item.id.toString());
                  return (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => addToManualOrder(item.id)}
                      className="group text-left bg-white border border-slate-200 rounded-xl overflow-hidden hover:border-primary hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
                        <div className="absolute inset-0 flex items-center justify-center text-slate-300">
                          <Coffee size={30} />
                        </div>
                        {item.image && (
                          <img
                            src={item.image}
                            alt=""
                            className="relative w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-200"
                            referrerPolicy="no-referrer"
                            onError={(event) => { event.currentTarget.style.display = 'none'; }}
                          />
                        )}
                        {cartItem && (
                          <span className="absolute top-2 right-2 min-w-7 h-7 px-2 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shadow-sm">
                            {cartItem.quantity}
                          </span>
                        )}
                      </div>
                      <div className="p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[10px] uppercase tracking-wide text-slate-400 truncate">{item.category || 'Menu'}</p>
                          {item.preorder && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">PO · sisa {item.stock}</span>}
                        </div>
                        <h3 className="text-sm font-semibold text-slate-800 line-clamp-2 min-h-10 mt-1">{item.name}</h3>
                        <div className="flex items-center justify-between mt-2 gap-2">
                          <span className="text-sm font-bold text-primary">Rp {(item.price || 0).toLocaleString()}</span>
                          <span className="w-7 h-7 rounded-md bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                            <Plus size={15} />
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <aside className="min-h-[520px] xl:min-h-0 bg-white flex flex-col">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingBag size={18} className="text-primary" />
              <h3 className="text-sm font-semibold text-slate-900">Pesanan Saat Ini</h3>
            </div>
            {selectedItems.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedItems([])}
                className="text-xs font-medium text-rose-600 hover:bg-rose-50 px-2.5 py-1.5 rounded-md flex items-center gap-1.5"
              >
                <Trash2 size={13} /> Kosongkan
              </button>
            )}
          </div>

          <div className="p-5 border-b border-slate-200 space-y-3">
            <label className="block">
              <span className="text-xs font-medium text-slate-600 mb-1.5 block">Pelanggan</span>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  placeholder="Nama atau nomor telepon"
                  value={manualCustomerName}
                  onChange={(event) => setManualCustomerName(event.target.value)}
                  className="w-full h-10 bg-white border border-slate-200 rounded-lg pl-9 pr-3 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                />
              </div>
            </label>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
            {selectedItems.length === 0 ? (
              <div className="h-full min-h-52 flex flex-col items-center justify-center text-center px-8">
                <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                  <ShoppingBag size={25} className="text-slate-300" />
                </div>
                <p className="text-sm font-medium text-slate-600">Keranjang masih kosong</p>
                <p className="text-xs text-slate-400 mt-1">Klik produk untuk menambahkannya.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {selectedItems.map(cartItem => {
                  const menu = menuItems.find(item => item.id.toString() === cartItem.id.toString());
                  if (!menu) return null;
                  return (
                    <motion.div
                      layout
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      key={cartItem.id}
                      className="px-5 py-3.5 flex items-center gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-medium text-slate-800 truncate">{menu.name}</h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Rp {(menu.price || 0).toLocaleString()} × {cartItem.quantity}
                        </p>
                      </div>
                      <div className="h-8 flex items-center border border-slate-200 rounded-md overflow-hidden shrink-0">
                        <button
                          type="button"
                          onClick={() => removeFromManualOrder(menu.id)}
                          className="w-8 h-full flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-rose-600"
                          aria-label={`Kurangi ${menu.name}`}
                        >
                          <Minus size={13} />
                        </button>
                        <span className="w-8 text-center text-xs font-semibold text-slate-800">{cartItem.quantity}</span>
                        <button
                          type="button"
                          onClick={() => addToManualOrder(menu.id)}
                          className="w-8 h-full flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-primary"
                          aria-label={`Tambah ${menu.name}`}
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                      <p className="w-24 text-right text-sm font-semibold text-slate-800 shrink-0">
                        Rp {((menu.price || 0) * cartItem.quantity).toLocaleString()}
                      </p>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 p-5 space-y-4 bg-white">
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'Tunai', label: 'Tunai', icon: Banknote },
                { value: 'QRIS', label: 'QRIS', icon: CreditCard },
                { value: 'Transfer', label: 'Transfer', icon: CreditCard },
                { value: 'Debit', label: 'Debit', icon: CreditCard }
              ].map(method => (
                <button
                  type="button"
                  key={method.value}
                  onClick={() => setPaymentMethod(method.value)}
                  className={cn(
                    'h-10 border rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition-colors',
                    paymentMethod === method.value
                      ? 'bg-primary/10 border-primary text-primary'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  )}
                >
                  <method.icon size={15} /> {method.label}
                </button>
              ))}
            </div>

            {orderMode === 'preorder' ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-500">Waktu pembayaran PO</p>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setPaymentTiming('before_pickup')} className={cn('p-2.5 rounded-lg border text-xs font-semibold', paymentTiming === 'before_pickup' ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 text-slate-600')}>Bayar sebelum pengambilan</button>
                  <button type="button" onClick={() => setPaymentTiming('on_pickup')} className={cn('p-2.5 rounded-lg border text-xs font-semibold', paymentTiming === 'on_pickup' ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 text-slate-600')}>Bayar saat/setelah pengambilan</button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-slate-500">Status pembayaran</span>
                <div className="flex bg-slate-100 rounded-md p-1">
                  <button
                    type="button"
                    onClick={() => setPaymentStatus('belum_bayar')}
                    className={cn(
                      'px-3 py-1.5 rounded text-xs font-medium',
                      paymentStatus === 'belum_bayar' ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-500'
                    )}
                  >
                    Belum Bayar
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentStatus('lunas')}
                    className={cn(
                      'px-3 py-1.5 rounded text-xs font-medium',
                      paymentStatus === 'lunas' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'
                    )}
                  >
                    Lunas
                  </button>
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-slate-100 flex items-end justify-between">
              <div>
                <p className="text-xs text-slate-500">Total pembayaran</p>
                <p className="text-2xl font-bold text-slate-900 mt-0.5">Rp {manualOrderTotal.toLocaleString()}</p>
              </div>
              <p className="text-xs text-slate-400">{selectedItems.reduce((total, item) => total + item.quantity, 0)} item</p>
            </div>

            {successMessage && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-xs font-medium flex items-center gap-2"
              >
                <Check size={15} /> {successMessage}
              </motion.div>
            )}

            {errorMessage && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs font-medium"
              >
                {errorMessage}
              </motion.div>
            )}

            <button
              type="button"
              disabled={!manualCustomerName || selectedItems.length === 0 || manualSubmitting || (orderMode === 'preorder' && !selectedCampaignId)}
              onClick={submitManualOrder}
              className="w-full h-12 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {manualSubmitting ? <RefreshCw size={18} className="animate-spin" /> : <Check size={18} />}
              {manualSubmitting ? 'Menyimpan pesanan...' : 'Konfirmasi Pesanan'}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
