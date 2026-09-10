import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle, Barcode, Box, Camera, CheckCircle2, ClipboardList, History,
  Loader2, PackagePlus, Pencil, Plus, RefreshCw, Save, Search, Trash2, X, Zap
} from 'lucide-react';
import socket from '../lib/socket';
import { authFetch } from '../lib/authFetch';

type StockLevel = 'safe' | 'low' | 'critical' | 'out';
type InventoryItem = {
  id: string; name: string; inventoryType: 'raw_material' | 'packaged_product'; sku: string;
  barcode: string; category: string; unit: string; purchaseUnit: string; purchaseConversion: number;
  stock: number; minStock: number; criticalStock: number; costPrice: number; supplier: string;
  outlet: string; isActive: boolean; level: StockLevel;
};
type Summary = { total: number; counts: Record<StockLevel, number>; alerts: InventoryItem[]; estimatedPurchaseValue: number };
type Movement = { id: number; item_name: string; movement_type: string; quantity: number; stock_before: number; stock_after: number; unit: string; input_method: string; actor_name: string; created_at: string; notes?: string };
type RecipeRow = { menu_name: string; ingredient_id: string; ingredient_name: string; amount: number; unit: string };
type Menu = { id: string; name: string };

const emptyItem = {
  name: '', inventoryType: 'raw_material' as const, sku: '', barcode: '', category: 'Bahan Baku', unit: 'pcs',
  purchaseUnit: 'pcs', purchaseConversion: 1, stock: 0, minStock: 10, criticalStock: 3,
  costPrice: 0, supplier: '', outlet: 'ngolab', isActive: true
};
const levelMeta: Record<StockLevel, { label: string; color: string }> = {
  safe: { label: 'Aman', color: 'bg-emerald-100 text-emerald-700' },
  low: { label: 'Menipis', color: 'bg-amber-100 text-amber-700' },
  critical: { label: 'Kritis', color: 'bg-rose-100 text-rose-700' },
  out: { label: 'Habis', color: 'bg-slate-900 text-white' }
};
const movementLabels: Record<string, string> = {
  purchase: 'Stok Masuk', adjustment: 'Koreksi', waste: 'Rusak/Terbuang', stock_opname: 'Stock Opname',
  transfer_in: 'Transfer Masuk', transfer_out: 'Transfer Keluar', sale: 'Penjualan', refund: 'Pengembalian'
};

export default function StockManagement() {
  const [tab, setTab] = useState<'dashboard' | 'items' | 'receive' | 'recipes' | 'history'>('dashboard');
  const [outlet, setOutlet] = useState<'ngolab' | 'coworking'>('ngolab');
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [recipes, setRecipes] = useState<RecipeRow[]>([]);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [search, setSearch] = useState('');
  const [itemModal, setItemModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [itemForm, setItemForm] = useState<any>(emptyItem);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [movementForm, setMovementForm] = useState({ type: 'purchase', quantity: 1, input_method: 'manual', unit_cost: 0, supplier: '', batch_number: '', expires_at: '', notes: '', use_purchase_unit: true });
  const [cameraOpen, setCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<number | null>(null);
  const [selectedMenu, setSelectedMenu] = useState('');
  const [recipeDraft, setRecipeDraft] = useState<Array<{ ingredient_id: string; amount: number }>>([]);

  const requestJson = async (url: string, init?: RequestInit) => {
    const response = await authFetch(url, init);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || 'Permintaan gagal.');
    return data;
  };

  const loadAll = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [inventory, stockSummary, movementData, recipeData, menuData] = await Promise.all([
        requestJson(`/api/ingredients?outlet=${outlet}`), requestJson(`/api/ingredients/summary?outlet=${outlet}`),
        requestJson(`/api/ingredients/movements?outlet=${outlet}&limit=200`), requestJson(`/api/ingredients/recipes?outlet=${outlet}`),
        requestJson(`/api/menu?outlet=${outlet}&source=local`)
      ]);
      setItems(inventory); setSummary(stockSummary); setMovements(movementData); setRecipes(recipeData);
      setMenus((Array.isArray(menuData) ? menuData : []).map((menu: any) => ({ id: String(menu.id), name: menu.name })));
    } catch (requestError: any) { setError(requestError.message); }
    finally { setLoading(false); }
  }, [outlet]);

  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => {
    const refresh = () => loadAll();
    const alert = (change: any) => { setToast(`Stok ${change.name} ${levelMeta[change.level as StockLevel]?.label?.toLowerCase() || 'berubah'}: ${change.after} ${change.unit}`); loadAll(); };
    socket.on('inventory_updated', refresh); socket.on('low_stock_alert', alert);
    return () => { socket.off('inventory_updated', refresh); socket.off('low_stock_alert', alert); };
  }, [loadAll]);
  useEffect(() => { if (!toast) return; const id = window.setTimeout(() => setToast(''), 5000); return () => clearTimeout(id); }, [toast]);
  useEffect(() => () => stopCamera(), []);

  const lookupBarcode = async (raw = barcodeInput, method: 'barcode' | 'camera' = 'barcode') => {
    const code = raw.trim(); if (!code) return;
    try {
      const item = await requestJson(`/api/ingredients/barcode/${encodeURIComponent(code)}?outlet=${outlet}`);
      setSelectedItem(item); setBarcodeInput(code); setMovementForm(current => ({ ...current, input_method: method, supplier: item.supplier || '', unit_cost: item.costPrice || 0 })); setTab('receive');
      setToast(`${item.name} ditemukan.`);
    } catch {
      setItemForm({ ...emptyItem, outlet, barcode: code }); setEditingId(null); setItemModal(true);
      setToast('Barcode belum terdaftar. Lengkapi data barang baru.');
    }
  };

  const stopCamera = () => {
    if (scanTimerRef.current) window.clearInterval(scanTimerRef.current);
    scanTimerRef.current = null; streamRef.current?.getTracks().forEach(track => track.stop()); streamRef.current = null; setCameraOpen(false);
  };
  const startCamera = async () => {
    setError('');
    try {
      const Detector = (window as any).BarcodeDetector;
      if (!Detector) throw new Error('Browser ini belum mendukung scan barcode kamera. Gunakan Chrome/Edge terbaru atau scanner USB.');
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } });
      streamRef.current = stream; setCameraOpen(true);
      window.setTimeout(() => { if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); } }, 50);
      const detector = new Detector({ formats: ['ean_13', 'ean_8', 'code_128', 'qr_code', 'upc_a', 'upc_e'] });
      scanTimerRef.current = window.setInterval(async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) return;
        try { const codes = await detector.detect(videoRef.current); if (codes[0]?.rawValue) { const code = codes[0].rawValue; stopCamera(); setBarcodeInput(code); lookupBarcode(code, 'camera'); } } catch { /* frame berikutnya */ }
      }, 400);
    } catch (cameraError: any) { stopCamera(); setError(cameraError.message || 'Kamera tidak dapat dibuka.'); }
  };

  const saveItem = async (event: React.FormEvent) => {
    event.preventDefault(); setError('');
    try {
      const url = editingId ? `/api/ingredients/${editingId}` : '/api/ingredients';
      const saved = await requestJson(url, { method: editingId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(itemForm) });
      setItemModal(false); setEditingId(null); setItemForm({ ...emptyItem, outlet }); setSelectedItem(saved); setBarcodeInput(saved.barcode || ''); setToast('Data inventori berhasil disimpan.'); await loadAll();
    } catch (requestError: any) { setError(requestError.message); }
  };
  const editItem = (item: InventoryItem) => { setEditingId(item.id); setItemForm({ ...item }); setItemModal(true); };

  const saveMovement = async (event: React.FormEvent) => {
    event.preventDefault(); if (!selectedItem) return; setError('');
    try {
      const result = await requestJson(`/api/ingredients/${selectedItem.id}/movements`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(movementForm) });
      setSelectedItem(result.item); setMovementForm(current => ({ ...current, quantity: 1, batch_number: '', expires_at: '', notes: '' }));
      setToast(`${movementLabels[movementForm.type]} ${result.item.name} berhasil.`); await loadAll();
    } catch (requestError: any) { setError(requestError.message); }
  };

  const chooseMenu = (menuName: string) => {
    setSelectedMenu(menuName);
    const existing = recipes.filter(row => row.menu_name === menuName).map(row => ({ ingredient_id: row.ingredient_id, amount: row.amount }));
    setRecipeDraft(existing.length ? existing : [{ ingredient_id: items[0]?.id || '', amount: 1 }]);
  };
  const saveRecipe = async () => {
    if (!selectedMenu) return;
    try {
      await requestJson(`/api/ingredients/recipes/${encodeURIComponent(selectedMenu)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ outlet, items: recipeDraft }) });
      setToast(`Resep ${selectedMenu} berhasil disimpan.`); await loadAll(); chooseMenu(selectedMenu);
    } catch (requestError: any) { setError(requestError.message); }
  };

  const filtered = items.filter(item => `${item.name} ${item.sku} ${item.barcode} ${item.category}`.toLowerCase().includes(search.toLowerCase()));
  const tabs = [
    ['dashboard', 'Ringkasan', Zap], ['items', 'Master Barang', Box], ['receive', 'Input & Scan', Barcode],
    ['recipes', 'Resep Menu', ClipboardList], ['history', 'Riwayat Mutasi', History]
  ] as const;

  if (loading && !summary) return <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-indigo-600" /></div>;

  return <div className="space-y-6 pb-24">
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
      <div><h2 className="text-2xl font-bold text-slate-900 dark:text-white">Inventori {outlet === 'ngolab' ? 'Ngolab' : 'Coworking'}</h2><p className="text-sm text-slate-500">Bahan resep, minuman kemasan, barcode, mutasi, dan peringatan stok.</p></div>
      <div className="flex items-center gap-2"><div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">{(['ngolab', 'coworking'] as const).map(value => <button key={value} onClick={() => { setOutlet(value); setSelectedItem(null); setSelectedMenu(''); }} className={`px-3 py-2 rounded-lg text-xs font-bold ${outlet === value ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500'}`}>{value === 'ngolab' ? 'Ngolab' : 'Coworking'}</button>)}</div><button onClick={loadAll} className="self-start px-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex gap-2 items-center text-sm font-bold"><RefreshCw size={16} /> Perbarui</button></div>
    </div>

    {error && <div className="p-4 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 flex gap-2"><AlertTriangle size={19} />{error}</div>}
    {toast && <div className="fixed top-5 right-5 z-[70] max-w-sm p-4 rounded-xl bg-slate-900 text-white shadow-2xl flex gap-3"><CheckCircle2 className="text-emerald-400" />{toast}</div>}

    <div className="flex gap-2 overflow-x-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2 rounded-2xl">
      {tabs.map(([id, label, Icon]) => <button key={id} onClick={() => setTab(id)} className={`px-4 py-2.5 rounded-xl whitespace-nowrap flex items-center gap-2 text-sm font-bold ${tab === id ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}><Icon size={16} />{label}</button>)}
    </div>

    {tab === 'dashboard' && summary && <>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[['Total Item', summary.total, 'bg-indigo-50 text-indigo-700'], ['Aman', summary.counts.safe, 'bg-emerald-50 text-emerald-700'], ['Menipis', summary.counts.low, 'bg-amber-50 text-amber-700'], ['Kritis', summary.counts.critical, 'bg-rose-50 text-rose-700'], ['Habis', summary.counts.out, 'bg-slate-900 text-white']].map(([label, value, color]) => <div key={String(label)} className={`rounded-2xl p-5 ${color}`}><p className="text-xs font-bold uppercase opacity-70">{label}</p><p className="text-3xl font-black mt-2">{value}</p></div>)}
      </div>
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="p-5 border-b dark:border-slate-800"><h3 className="font-bold dark:text-white">Perlu Dibeli</h3><p className="text-xs text-slate-500">Item yang sudah mencapai batas minimum.</p></div>
        {!summary.alerts.length ? <p className="p-6 text-emerald-600">Semua stok dalam kondisi aman.</p> : summary.alerts.map(item => <div key={item.id} className="p-4 border-b last:border-0 dark:border-slate-800 flex items-center gap-4"><span className={`px-2 py-1 text-xs rounded-full font-bold ${levelMeta[item.level].color}`}>{levelMeta[item.level].label}</span><div className="flex-1"><p className="font-bold dark:text-white">{item.name}</p><p className="text-xs text-slate-500">Tersisa {item.stock} {item.unit} · Minimum {item.minStock}</p></div><button onClick={() => { setSelectedItem(item); setTab('receive'); }} className="px-3 py-2 rounded-lg bg-indigo-50 text-indigo-700 font-bold text-xs">Restock</button></div>)}
      </div>
    </>}

    {tab === 'items' && <>
      <div className="flex gap-3"><div className="relative flex-1"><Search className="absolute left-4 top-3.5 text-slate-400" size={18}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari nama, SKU, barcode..." className="w-full pl-11 pr-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 dark:text-white" /></div><button onClick={() => { setEditingId(null); setItemForm({ ...emptyItem, outlet }); setItemModal(true); }} className="px-4 py-3 bg-indigo-600 text-white rounded-xl font-bold flex gap-2"><Plus size={18}/> Item</button></div>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">{filtered.map(item => <div key={item.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5"><div className="flex justify-between"><div><span className={`text-[10px] px-2 py-1 rounded-full font-bold ${levelMeta[item.level].color}`}>{levelMeta[item.level].label}</span><h3 className="font-bold mt-3 dark:text-white">{item.name}</h3><p className="text-xs text-slate-500">{item.inventoryType === 'raw_material' ? 'Bahan resep' : 'Barang kemasan'} · {item.sku}</p></div><button onClick={() => editItem(item)} className="p-2 h-9 rounded-lg bg-slate-100 dark:bg-slate-800"><Pencil size={15}/></button></div><p className="text-3xl font-black text-indigo-600 mt-5">{item.stock} <span className="text-sm font-medium text-slate-500">{item.unit}</span></p><p className="text-xs text-slate-400 mt-2">Barcode: {item.barcode || 'Belum ada'} · Min: {item.minStock} · Kritis: {item.criticalStock}</p></div>)}</div>
    </>}

    {tab === 'receive' && <div className="grid lg:grid-cols-2 gap-6">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6"><h3 className="font-bold dark:text-white flex gap-2"><Barcode/> Scan atau Cari Barang</h3><p className="text-xs text-slate-500 mt-1">Scanner USB akan mengetik barcode dan menekan Enter otomatis.</p><div className="flex gap-2 mt-5"><input autoFocus value={barcodeInput} onChange={e => setBarcodeInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); lookupBarcode(); } }} placeholder="Scan/ketik barcode lalu Enter" className="flex-1 rounded-xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-3 dark:text-white"/><button onClick={() => lookupBarcode()} className="px-4 rounded-xl bg-indigo-600 text-white font-bold">Cari</button><button onClick={startCamera} className="px-4 rounded-xl bg-slate-900 text-white" title="Scan kamera"><Camera/></button></div><p className="text-center text-xs text-slate-400 my-4">atau pilih manual</p><select value={selectedItem?.id || ''} onChange={e => { const item = items.find(i => i.id === e.target.value) || null; setSelectedItem(item); if (item) setMovementForm(current => ({...current, supplier: item.supplier, unit_cost: item.costPrice, input_method: 'manual'})); }} className="w-full rounded-xl border dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-3 dark:text-white"><option value="">Pilih barang...</option>{items.filter(i => i.isActive).map(item => <option key={item.id} value={item.id}>{item.name} — {item.stock} {item.unit}</option>)}</select></div>
      <form onSubmit={saveMovement} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6"><h3 className="font-bold dark:text-white flex gap-2"><PackagePlus/> Catat Mutasi Stok</h3>{!selectedItem ? <p className="mt-6 text-sm text-slate-500">Scan atau pilih barang terlebih dahulu.</p> : <div className="space-y-4 mt-5"><div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-500/10"><p className="font-bold text-indigo-800 dark:text-indigo-300">{selectedItem.name}</p><p className="text-xs text-indigo-600">Stok: {selectedItem.stock} {selectedItem.unit} · 1 {selectedItem.purchaseUnit} = {selectedItem.purchaseConversion} {selectedItem.unit}</p></div><select value={movementForm.type} onChange={e => setMovementForm({...movementForm, type:e.target.value})} className="w-full rounded-xl border dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-3 dark:text-white">{['purchase','waste','stock_opname','adjustment','transfer_in','transfer_out'].map(type => <option value={type} key={type}>{movementLabels[type]}</option>)}</select><label className="block text-xs font-bold text-slate-500">{movementForm.type === 'stock_opname' || movementForm.type === 'adjustment' ? `HASIL HITUNG FISIK (${selectedItem.unit})` : `JUMLAH (${movementForm.type === 'purchase' ? selectedItem.purchaseUnit : selectedItem.unit})`}<input type="number" min="0" step="any" value={movementForm.quantity} onChange={e => setMovementForm({...movementForm,quantity:Number(e.target.value)})} className="mt-1 w-full rounded-xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-3 dark:text-white" required/></label>{movementForm.type === 'purchase' && <div className="grid grid-cols-2 gap-3"><input placeholder="Supplier" value={movementForm.supplier} onChange={e=>setMovementForm({...movementForm,supplier:e.target.value})} className="rounded-xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-3 dark:text-white"/><input type="number" placeholder="Harga/unit dasar" value={movementForm.unit_cost} onChange={e=>setMovementForm({...movementForm,unit_cost:Number(e.target.value)})} className="rounded-xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-3 dark:text-white"/><input placeholder="Nomor batch" value={movementForm.batch_number} onChange={e=>setMovementForm({...movementForm,batch_number:e.target.value})} className="rounded-xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-3 dark:text-white"/><input type="date" value={movementForm.expires_at} onChange={e=>setMovementForm({...movementForm,expires_at:e.target.value})} className="rounded-xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-3 dark:text-white"/></div>}<textarea placeholder="Catatan/alasan" value={movementForm.notes} onChange={e=>setMovementForm({...movementForm,notes:e.target.value})} className="w-full rounded-xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-3 dark:text-white"/><button className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold flex justify-center gap-2"><Save size={18}/> Simpan Mutasi</button></div>}</form>
    </div>}

    {tab === 'recipes' && <div className="grid lg:grid-cols-[320px_1fr] gap-6"><div className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-800 p-5"><h3 className="font-bold dark:text-white mb-4">Pilih Menu</h3><div className="space-y-2 max-h-[560px] overflow-y-auto">{menus.map(menu => <button key={menu.id} onClick={() => chooseMenu(menu.name)} className={`w-full text-left px-3 py-2.5 rounded-xl text-sm ${selectedMenu === menu.name ? 'bg-indigo-600 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-slate-300'}`}>{menu.name}</button>)}</div></div><div className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-800 p-6"><h3 className="font-bold dark:text-white">Komposisi {selectedMenu || 'Menu'}</h3>{!selectedMenu ? <p className="text-sm text-slate-500 mt-5">Pilih menu untuk mengatur bahan. Untuk minuman kemasan, pilih barang yang sama dengan jumlah 1.</p> : <div className="space-y-3 mt-5">{recipeDraft.map((row,index) => <div key={index} className="grid grid-cols-[1fr_120px_40px] gap-2"><select value={row.ingredient_id} onChange={e=>setRecipeDraft(current=>current.map((r,i)=>i===index?{...r,ingredient_id:e.target.value}:r))} className="rounded-xl border dark:border-slate-700 bg-white dark:bg-slate-950 px-3 dark:text-white"><option value="">Pilih bahan...</option>{items.filter(i=>i.isActive).map(item=><option key={item.id} value={item.id}>{item.name} ({item.unit})</option>)}</select><input type="number" min="0.001" step="any" value={row.amount} onChange={e=>setRecipeDraft(current=>current.map((r,i)=>i===index?{...r,amount:Number(e.target.value)}:r))} className="rounded-xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 dark:text-white"/><button onClick={()=>setRecipeDraft(current=>current.filter((_,i)=>i!==index))} className="rounded-xl bg-rose-50 text-rose-600"><Trash2 size={16} className="mx-auto"/></button></div>)}<div className="flex gap-2"><button onClick={()=>setRecipeDraft([...recipeDraft,{ingredient_id:items[0]?.id||'',amount:1}])} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl font-bold text-sm dark:text-white"><Plus size={15} className="inline"/> Bahan</button><button onClick={saveRecipe} disabled={!recipeDraft.length || recipeDraft.some(r=>!r.ingredient_id || r.amount<=0)} className="px-4 py-2 bg-indigo-600 disabled:opacity-50 text-white rounded-xl font-bold text-sm"><Save size={15} className="inline"/> Simpan Resep</button></div></div>}</div></div>}

    {tab === 'history' && <div className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-800 overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 dark:bg-slate-950 text-slate-500"><tr>{['Waktu','Barang','Jenis','Perubahan','Sebelum → Sesudah','Metode','Petugas'].map(h=><th key={h} className="px-4 py-3 text-left">{h}</th>)}</tr></thead><tbody>{movements.map(m=><tr key={m.id} className="border-t dark:border-slate-800"><td className="px-4 py-3 whitespace-nowrap">{new Date(m.created_at).toLocaleString('id-ID')}</td><td className="px-4 py-3 font-bold dark:text-white">{m.item_name}</td><td className="px-4 py-3">{movementLabels[m.movement_type]||m.movement_type}</td><td className={`px-4 py-3 font-bold ${m.quantity>=0?'text-emerald-600':'text-rose-600'}`}>{m.quantity>=0?'+':''}{m.quantity} {m.unit}</td><td className="px-4 py-3">{m.stock_before} → {m.stock_after}</td><td className="px-4 py-3">{m.input_method}</td><td className="px-4 py-3">{m.actor_name}</td></tr>)}</tbody></table></div>}

    {itemModal && <div className="fixed inset-0 z-50 flex items-center justify-center p-4"><div className="absolute inset-0 bg-slate-950/60" onClick={()=>setItemModal(false)}/><form onSubmit={saveItem} className="relative bg-white dark:bg-slate-900 w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl p-6"><div className="flex justify-between"><h3 className="text-xl font-bold dark:text-white">{editingId?'Ubah':'Tambah'} Item Inventori</h3><button type="button" onClick={()=>setItemModal(false)}><X/></button></div><div className="grid md:grid-cols-2 gap-3 mt-5"><input required placeholder="Nama barang/bahan" value={itemForm.name} onChange={e=>setItemForm({...itemForm,name:e.target.value})} className="field"/><select value={itemForm.inventoryType} onChange={e=>setItemForm({...itemForm,inventoryType:e.target.value,category:e.target.value==='raw_material'?'Bahan Baku':'Minuman & Kemasan'})} className="field"><option value="raw_material">Bahan Resep</option><option value="packaged_product">Minuman/Barang Kemasan</option></select><input placeholder="SKU (otomatis bila kosong)" value={itemForm.sku} onChange={e=>setItemForm({...itemForm,sku:e.target.value})} className="field"/><input placeholder="Barcode" value={itemForm.barcode} onChange={e=>setItemForm({...itemForm,barcode:e.target.value})} className="field"/><input placeholder="Kategori" value={itemForm.category} onChange={e=>setItemForm({...itemForm,category:e.target.value})} className="field"/><input required placeholder="Satuan dasar: gram/ml/pcs" value={itemForm.unit} onChange={e=>setItemForm({...itemForm,unit:e.target.value})} className="field"/><input placeholder="Satuan beli: kg/dus/pack" value={itemForm.purchaseUnit} onChange={e=>setItemForm({...itemForm,purchaseUnit:e.target.value})} className="field"/><label className="text-xs text-slate-500">ISI PER SATUAN BELI<input type="number" min="0.001" step="any" value={itemForm.purchaseConversion} onChange={e=>setItemForm({...itemForm,purchaseConversion:Number(e.target.value)})} className="field mt-1"/></label><label className="text-xs text-slate-500">STOK AWAL<input type="number" min="0" step="any" disabled={!!editingId} value={itemForm.stock} onChange={e=>setItemForm({...itemForm,stock:Number(e.target.value)})} className="field mt-1"/></label><label className="text-xs text-slate-500">BATAS MENIPIS<input type="number" min="0" step="any" value={itemForm.minStock} onChange={e=>setItemForm({...itemForm,minStock:Number(e.target.value)})} className="field mt-1"/></label><label className="text-xs text-slate-500">BATAS KRITIS<input type="number" min="0" step="any" value={itemForm.criticalStock} onChange={e=>setItemForm({...itemForm,criticalStock:Number(e.target.value)})} className="field mt-1"/></label><label className="text-xs text-slate-500">HARGA BELI / UNIT DASAR<input type="number" min="0" value={itemForm.costPrice} onChange={e=>setItemForm({...itemForm,costPrice:Number(e.target.value)})} className="field mt-1"/></label><input placeholder="Supplier" value={itemForm.supplier} onChange={e=>setItemForm({...itemForm,supplier:e.target.value})} className="field md:col-span-2"/></div><button className="mt-5 w-full py-3 bg-indigo-600 text-white rounded-xl font-bold">Simpan Item</button></form></div>}

    {cameraOpen && <div className="fixed inset-0 z-[60] bg-slate-950/90 flex flex-col items-center justify-center p-4"><button onClick={stopCamera} className="absolute top-5 right-5 text-white"><X size={28}/></button><h3 className="text-white font-bold mb-4">Arahkan kamera ke barcode</h3><video ref={videoRef} playsInline muted className="w-full max-w-xl rounded-2xl border-2 border-indigo-400"/><p className="text-slate-300 text-sm mt-4">Pemindaian berjalan otomatis.</p></div>}

    <style>{`.field{width:100%;border:1px solid rgb(226 232 240);border-radius:.75rem;padding:.75rem 1rem;background:rgb(248 250 252);color:rgb(15 23 42)}.dark .field{background:rgb(2 6 23);border-color:rgb(51 65 85);color:white}`}</style>
  </div>;
}
