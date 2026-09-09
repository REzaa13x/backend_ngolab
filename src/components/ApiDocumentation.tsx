import React, { useState } from 'react';
import { 
  Key, 
  Copy, 
  RefreshCw, 
  EyeOff, 
  Eye, 
  AlertCircle, 
  Info,
  Check,
  Webhook,
  Lock,
  X,
  AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function ApiDocumentation() {
  const [apiKey, setApiKey] = useState('uni_34880212ff12d264c6a8a495ed3b58197ad8d8bdb78230c1');
  const [showKey, setShowKey] = useState(false);
  const [urlProd, setUrlProd] = useState('https://api-cms.uniinside.net');
  const [copiedUrlProd, setCopiedUrlProd] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  // Modals state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const handleCopy = (text: string, setCopied: React.Dispatch<React.SetStateAction<boolean>>) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const initiateRegenerate = () => {
    setPassword('');
    setPasswordError('');
    setShowPasswordModal(true);
  };

  const handleVerifyPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setPasswordError('Password tidak boleh kosong.');
      return;
    }
    
    setIsVerifying(true);
    setPasswordError('');

    // Simulate API call for password verification
    setTimeout(() => {
      setIsVerifying(false);
      // Dummy check: For demo purposes, we accept "admin123"
      if (password === 'admin123') {
        setShowPasswordModal(false);
        setTimeout(() => {
          setShowConfirmModal(true);
        }, 150); // Small delay for smoother transition between modals
      } else {
        setPasswordError('Password tidak valid. Silakan coba lagi. (hint: admin123)');
      }
    }, 800);
  };

  const confirmRegenerate = () => {
    // Dummy regeneration logic
    const newKey = 'uni_' + Array.from({length: 40}, () => Math.floor(Math.random()*16).toString(16)).join('');
    setApiKey(newKey);
    setShowConfirmModal(false);
  };

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Panduan Integrasi API</h2>
        <p className="text-slate-500 dark:text-slate-400">Pelajari cara menghubungkan dan mengintegrasikan frontend Anda ke API sistem.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* URL Dasar API Publik */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden flex flex-col">
          <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 dark:bg-orange-500/5 rounded-full blur-3xl -mr-20 -mt-20"></div>
          
          <div className="relative z-10 flex flex-col h-full">
            <div className="flex items-center gap-3 mb-6">
              <Webhook className="text-orange-500" />
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">URL Dasar API Publik</h3>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">Semua endpoint relatif terhadap URL dasar berikut.</p>

            <div className="space-y-6 mb-auto">
              {/* URL Produksi */}
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">URL NGOLAB (PRODUKSI)</label>
                <div className="flex bg-slate-50 dark:bg-slate-950 rounded-xl p-1 items-center border border-slate-200 dark:border-slate-800 focus-within:border-orange-500 focus-within:ring-1 focus-within:ring-orange-500 transition-all">
                  <input
                    type="text"
                    value={urlProd}
                    onChange={(e) => setUrlProd(e.target.value)}
                    className="flex-1 bg-transparent px-4 py-2 font-mono text-sm text-slate-900 dark:text-orange-400 focus:outline-none w-full"
                  />
                  <button 
                    onClick={() => handleCopy(urlProd, setCopiedUrlProd)}
                    className="p-3 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-white/10 rounded-lg transition-colors shrink-0"
                  >
                    {copiedUrlProd ? <Check size={18} className="text-emerald-500" /> : <Copy size={18} />}
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-8 space-y-4">
              <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl p-4 flex gap-3 text-emerald-700 dark:text-emerald-400">
                <Info className="w-5 h-5 shrink-0 mt-0.5" />
                <p className="text-sm leading-relaxed">Pastikan URL CMS disesuaikan dengan environment yang Anda gunakan saat ini.</p>
              </div>

              <div className="bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20 rounded-xl p-4 flex gap-3 text-orange-700 dark:text-orange-400">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold mb-1">TIPS: KEBUTUHAN HEADERS</p>
                  <p className="text-sm text-orange-700/80 dark:text-orange-400/80 leading-relaxed">Hampir semua permintaan membutuhkan header <code className="bg-orange-100 dark:bg-orange-500/20 px-1.5 py-0.5 rounded text-orange-800 dark:text-orange-300">x-api-key</code> untuk mengautentikasi aplikasi frontend.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Manajemen API Key */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/5 rounded-full blur-3xl -mr-20 -mt-20"></div>

          <div className="relative z-10 flex flex-col h-full">
            <div className="flex items-center gap-3 mb-2">
              <Key className="text-orange-500" />
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Manajemen API Key</h3>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-8">Kelola API key yang dibutuhkan untuk otorisasi frontend.</p>

            <div className="mb-6">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">KEY SAAT INI</label>
              <div className="relative">
                <input 
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  readOnly
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-4 pr-12 py-3 text-sm font-mono text-slate-900 dark:text-slate-300 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all"
                />
                <button 
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                >
                  {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="flex gap-3 mb-auto">
              <button 
                onClick={() => handleCopy(apiKey, setCopiedKey)}
                className="flex-1 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors border border-transparent dark:border-slate-700"
              >
                {copiedKey ? <Check size={18} /> : <Copy size={18} />}
                {copiedKey ? 'Tersalin!' : 'Salin Key'}
              </button>
              <button 
                onClick={initiateRegenerate}
                title="Regenerasi API Key"
                className="bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-rose-500 p-3 rounded-xl border border-rose-100 dark:border-rose-500/20 transition-colors shrink-0"
              >
                <RefreshCw size={20} />
              </button>
            </div>

            <div className="mt-8 bg-amber-50 dark:bg-amber-500/10 border border-amber-200/60 dark:border-amber-500/20 rounded-xl p-4 flex gap-3 text-amber-800 dark:text-amber-500">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-500" />
              <p className="text-sm leading-relaxed"><strong className="font-bold">Catatan:</strong> Meregenerasi API Key akan langsung menonaktifkan key sebelumnya. Pastikan Anda memperbarui variabel lingkungan frontend Anda segera setelah regenerasi.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showPasswordModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
              onClick={() => !isVerifying && setShowPasswordModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl overflow-hidden"
            >
              <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3 text-slate-900 dark:text-white">
                  <Lock className="w-5 h-5 text-indigo-500" />
                  <h3 className="text-lg font-bold">Verifikasi Keamanan</h3>
                </div>
                <button 
                  onClick={() => setShowPasswordModal(false)}
                  disabled={isVerifying}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 disabled:opacity-50"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleVerifyPassword} className="p-6">
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                  Untuk melanjutkan proses regenerasi API Key, silakan masukkan password akun admin Anda.
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                      PASSWORD
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isVerifying}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-slate-900 dark:text-white"
                      placeholder="Masukkan password admin"
                      autoFocus
                    />
                    {passwordError && (
                      <p className="text-xs text-rose-500 mt-2 flex items-center gap-1">
                        <AlertCircle size={14} />
                        {passwordError}
                      </p>
                    )}
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isVerifying}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl transition-colors disabled:opacity-70 flex justify-center items-center gap-2"
                    >
                      {isVerifying ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                          Memverifikasi...
                        </>
                      ) : (
                        'Lanjutkan'
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {showConfirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
              onClick={() => setShowConfirmModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl overflow-hidden"
            >
              <div className="p-6 flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-rose-50 dark:bg-rose-500/10 rounded-full flex items-center justify-center mb-6">
                  <AlertTriangle className="w-8 h-8 text-rose-500" />
                </div>
                
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                  Regenerasi API Key?
                </h3>
                
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
                  Tindakan ini akan membuat <strong className="text-slate-900 dark:text-white">API Key saat ini menjadi tidak valid</strong>. Semua sistem atau frontend yang menggunakan key lama akan terputus hingga Anda memperbaruinya dengan key yang baru.
                </p>

                <div className="flex gap-3 w-full">
                  <button
                    onClick={() => setShowConfirmModal(false)}
                    className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    onClick={confirmRegenerate}
                    className="flex-1 px-4 py-3 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl transition-colors"
                  >
                    Ya, Regenerasi
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
