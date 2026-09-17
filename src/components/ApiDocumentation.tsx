import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  Copy,
  Key,
  Lock,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Webhook,
  X
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { authFetch } from '../lib/authFetch';

type ApiScope = 'orders:read' | 'orders:write' | 'menu:read';

type ApiKeyRecord = {
  id: number;
  name: string;
  key_prefix: string;
  masked_key: string;
  scopes: ApiScope[];
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

const scopeOptions: Array<{ value: ApiScope; label: string; description: string }> = [
  { value: 'orders:read', label: 'Baca pesanan', description: 'Riwayat dan pesanan yang sedang masuk.' },
  { value: 'orders:write', label: 'Kirim pesanan', description: 'Membuat pesanan dari sistem mitra.' },
  { value: 'menu:read', label: 'Baca menu', description: 'Daftar menu, harga, stok, dan outlet.' }
];

const endpointDocs = [
  { method: 'GET', path: '/api/menu/external', scope: 'menu:read', description: 'Mengambil menu lokal Ngolab/Coworking.' },
  { method: 'GET', path: '/api/orders/external/history', scope: 'orders:read', description: 'Mengambil maksimal 100 riwayat pesanan.' },
  { method: 'GET', path: '/api/orders/external/incoming', scope: 'orders:read', description: 'Mengambil pesanan aktif untuk integrasi.' },
  { method: 'POST', path: '/api/orders/external', scope: 'orders:write', description: 'Mengirim pesanan baru ke Ngolab.' },
  { method: 'POST', path: '/api/orders/external/:id/payment-proof', scope: 'orders:write', description: "Upload JPG/PNG/GIF/WEBP maksimal 5 MB sebagai multipart field 'payment_proof'." }
];

export default function ApiDocumentation() {
  const [keys, setKeys] = useState<ApiKeyRecord[]>([]);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [scopes, setScopes] = useState<ApiScope[]>(['orders:read', 'orders:write', 'menu:read']);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [oneTimeKey, setOneTimeKey] = useState('');
  const [copied, setCopied] = useState('');
  const [pendingAction, setPendingAction] = useState<{ type: 'regenerate' | 'revoke'; key: ApiKeyRecord } | null>(null);
  const [actionPassword, setActionPassword] = useState('');

  const baseUrl = window.location.origin;

  const loadKeys = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await authFetch('/api/api-keys');
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Gagal memuat API Key.');
      setKeys(Array.isArray(data) ? data : []);
    } catch (requestError: any) {
      setError(requestError.message || 'Gagal memuat API Key.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadKeys(); }, [loadKeys]);

  const copyText = async (label: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    setTimeout(() => setCopied(''), 1800);
  };

  const toggleScope = (scope: ApiScope) => {
    setScopes(current => current.includes(scope) ? current.filter(item => item !== scope) : [...current, scope]);
  };

  const createKey = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      const response = await authFetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, password, scopes })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Gagal membuat API Key.');
      setOneTimeKey(data.api_key);
      setName('');
      setPassword('');
      setMessage(data.message);
      await loadKeys();
    } catch (requestError: any) {
      setError(requestError.message || 'Gagal membuat API Key.');
    } finally {
      setSubmitting(false);
    }
  };

  const submitKeyAction = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!pendingAction) return;
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      const response = await authFetch(`/api/api-keys/${pendingAction.key.id}/${pendingAction.type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: actionPassword })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Aksi API Key gagal.');
      if (data.api_key) setOneTimeKey(data.api_key);
      setMessage(data.message);
      setPendingAction(null);
      setActionPassword('');
      await loadKeys();
    } catch (requestError: any) {
      setError(requestError.message || 'Aksi API Key gagal.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">API & Integrasi</h2>
        <p className="text-slate-500 dark:text-slate-400">Buat credential terpisah untuk setiap sistem mitra. Key lengkap hanya ditampilkan sekali.</p>
      </div>

      {(error || message) && (
        <div className={`rounded-xl border p-4 flex gap-3 ${error ? 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-500/10 dark:border-rose-500/20 dark:text-rose-400' : 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400'}`}>
          {error ? <AlertCircle size={20} /> : <Check size={20} />}
          <p className="text-sm font-medium">{error || message}</p>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <Webhook className="text-orange-500" />
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white">URL Dasar Backend</h3>
              <p className="text-xs text-slate-500">Gunakan dari backend mitra, bukan langsung dari browser.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2">
            <code className="flex-1 px-2 text-sm text-slate-800 dark:text-slate-200 overflow-x-auto">{baseUrl}</code>
            <button onClick={() => copyText('base', baseUrl)} className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800" title="Salin URL">
              {copied === 'base' ? <Check size={18} className="text-emerald-500" /> : <Copy size={18} />}
            </button>
          </div>
          <div className="mt-4 bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20 rounded-xl p-4 text-sm text-orange-800 dark:text-orange-300">
            Sertakan header <code className="font-bold">x-api-key</code> pada setiap permintaan integrasi.
          </div>
        </section>

        <form onSubmit={createKey} className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <Plus className="text-indigo-500" />
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white">Buat API Key</h3>
              <p className="text-xs text-slate-500">Satu key untuk satu aplikasi atau mitra.</p>
            </div>
          </div>
          <div className="space-y-4">
            <input value={name} onChange={event => setName(event.target.value)} placeholder="Nama integrasi, contoh: Smart Tag" className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm dark:text-white" required minLength={2} maxLength={100} />
            <div className="grid gap-2">
              {scopeOptions.map(option => (
                <label key={option.value} className="flex gap-3 rounded-xl border border-slate-200 dark:border-slate-700 p-3 cursor-pointer">
                  <input type="checkbox" checked={scopes.includes(option.value)} onChange={() => toggleScope(option.value)} />
                  <span><span className="block text-sm font-bold text-slate-800 dark:text-slate-200">{option.label}</span><span className="block text-xs text-slate-500">{option.description}</span></span>
                </label>
              ))}
            </div>
            <div className="relative">
              <Lock size={17} className="absolute left-3 top-3.5 text-slate-400" />
              <input type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Password Super Admin" className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-10 pr-4 py-3 text-sm dark:text-white" required />
            </div>
            <button disabled={submitting || scopes.length === 0} className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold py-3 flex items-center justify-center gap-2">
              <Key size={18} /> {submitting ? 'Membuat...' : 'Generate API Key'}
            </button>
          </div>
        </form>
      </div>

      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div><h3 className="font-bold text-slate-900 dark:text-white">Credential Integrasi</h3><p className="text-xs text-slate-500 mt-1">Key mentah tidak disimpan dan tidak bisa dilihat kembali.</p></div>
          <button onClick={loadKeys} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" title="Muat ulang"><RefreshCw size={18} /></button>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {loading && <p className="p-6 text-sm text-slate-500">Memuat credential...</p>}
          {!loading && keys.length === 0 && <p className="p-6 text-sm text-slate-500">Belum ada API Key. Buat key pertama untuk sistem teman Anda.</p>}
          {!loading && keys.map(key => (
            <div key={key.id} className="p-5 flex flex-col lg:flex-row lg:items-center gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${key.is_active ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'}`}><ShieldCheck size={20} /></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2"><h4 className="font-bold text-slate-900 dark:text-white">{key.name}</h4><span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${key.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>{key.is_active ? 'AKTIF' : 'DICABUT'}</span></div>
                <code className="text-xs text-slate-500">{key.masked_key}</code>
                <p className="text-xs text-slate-400 mt-1">Izin: {key.scopes.join(', ')} · Terakhir dipakai: {key.last_used_at ? new Date(key.last_used_at).toLocaleString('id-ID') : 'Belum pernah'}</p>
              </div>
              {key.is_active && <div className="flex gap-2">
                <button onClick={() => { setPendingAction({ type: 'regenerate', key }); setActionPassword(''); }} className="px-3 py-2 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 text-sm font-bold flex items-center gap-2"><RefreshCw size={15} /> Regenerasi</button>
                <button onClick={() => { setPendingAction({ type: 'revoke', key }); setActionPassword(''); }} className="px-3 py-2 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 text-sm font-bold flex items-center gap-2"><Trash2 size={15} /> Cabut</button>
              </div>}
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800"><h3 className="font-bold text-slate-900 dark:text-white">Endpoint Integrasi</h3></div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {endpointDocs.map(endpoint => <div key={`${endpoint.method}-${endpoint.path}`} className="p-4 grid grid-cols-1 md:grid-cols-[70px_1fr_150px] gap-3 items-center text-sm"><span className={`font-bold ${endpoint.method === 'POST' ? 'text-orange-600' : 'text-emerald-600'}`}>{endpoint.method}</span><div><code className="text-slate-900 dark:text-slate-100">{endpoint.path}</code><p className="text-xs text-slate-500 mt-1">{endpoint.description}</p></div><span className="text-xs font-mono text-indigo-600">{endpoint.scope}</span></div>)}
        </div>
      </section>

      <AnimatePresence>
        {oneTimeKey && <div className="fixed inset-0 z-50 flex items-center justify-center p-4"><motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" /><motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-2xl"><div className="flex justify-between gap-4"><div><h3 className="text-xl font-bold dark:text-white">Simpan API Key Sekarang</h3><p className="text-sm text-amber-600 mt-1">Key lengkap hanya ditampilkan sekali dan tidak dapat dipulihkan.</p></div><button onClick={() => setOneTimeKey('')}><X size={20} /></button></div><div className="mt-5 flex gap-2 bg-slate-950 rounded-xl p-3"><code className="text-emerald-400 text-xs flex-1 break-all">{oneTimeKey}</code><button onClick={() => copyText('secret', oneTimeKey)} className="text-white p-2">{copied === 'secret' ? <Check size={18} /> : <Copy size={18} />}</button></div><button onClick={() => setOneTimeKey('')} className="mt-5 w-full bg-indigo-600 text-white rounded-xl py-3 font-bold">Saya Sudah Menyimpan Key</button></motion.div></div>}

        {pendingAction && <div className="fixed inset-0 z-50 flex items-center justify-center p-4"><motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => !submitting && setPendingAction(null)} /><motion.form onSubmit={submitKeyAction} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-2xl"><h3 className="text-xl font-bold dark:text-white">{pendingAction.type === 'regenerate' ? 'Regenerasi' : 'Cabut'} “{pendingAction.key.name}”?</h3><p className="text-sm text-slate-500 mt-2">Masukkan password Super Admin. {pendingAction.type === 'regenerate' ? 'Key lama akan langsung tidak berlaku.' : 'Integrasi ini akan langsung kehilangan akses.'}</p><input type="password" value={actionPassword} onChange={event => setActionPassword(event.target.value)} placeholder="Password Super Admin" autoFocus required className="mt-5 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm dark:text-white" /><div className="flex gap-3 mt-5"><button type="button" onClick={() => setPendingAction(null)} className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-xl py-3 font-bold">Batal</button><button disabled={submitting} className={`flex-1 text-white rounded-xl py-3 font-bold ${pendingAction.type === 'regenerate' ? 'bg-amber-600' : 'bg-rose-600'}`}>{submitting ? 'Memproses...' : 'Konfirmasi'}</button></div></motion.form></div>}
      </AnimatePresence>
    </div>
  );
}
