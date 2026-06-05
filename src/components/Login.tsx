import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Lock, User, Phone, LogIn, UserPlus, Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const [isLoginView, setIsLoginView] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Login Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Register Form State
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regRole, setRegRole] = useState('Kasir');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Login gagal');

      login(data.user);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: regName, email: regEmail, phone: regPhone, password: regPassword, role: regRole })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Registrasi gagal');

      // Setelah register, langsung login
      login(data.user);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center relative overflow-hidden">
      {/* Background Ornaments */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/30 blur-[120px] rounded-full mix-blend-screen pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[40%] h-[40%] bg-orange-500/20 blur-[120px] rounded-full mix-blend-screen pointer-events-none" />

      <div className="w-full max-w-[1000px] bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex z-10 mx-4">
        
        {/* Left Side (Banner) */}
        <div className="hidden lg:flex w-1/2 flex-col justify-between p-12 bg-gradient-to-br from-indigo-600/90 to-indigo-900/90 relative">
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?q=80&w=1200&auto=format&fit=crop')] mix-blend-overlay opacity-30 bg-cover bg-center" />
          
          <div className="relative z-10">
            <div className="w-16 h-16 rounded-full bg-white flex flex-col items-center justify-center shadow-lg border-4 border-indigo-400/30 mb-8">
              <span className="text-[14px] font-black text-indigo-900 tracking-tighter -mb-1">ngo</span>
              <span className="text-[14px] font-black text-indigo-900 tracking-tighter">lab</span>
            </div>
            
            <h1 className="text-4xl font-bold text-white mb-4 leading-tight">
              Platform Pintar<br/>Manajemen Bisnis Anda.
            </h1>
            <p className="text-indigo-200">
              Sistem point of sales, inventaris, pemasaran, dan manajemen staf dalam satu aplikasi yang tersinkronisasi.
            </p>
          </div>

          <div className="relative z-10 bg-black/20 p-6 rounded-2xl border border-white/10 backdrop-blur-sm">
            <div className="flex gap-4 items-center">
              <div className="w-12 h-12 rounded-full bg-indigo-500 flex items-center justify-center shrink-0">
                <Lock className="text-white w-6 h-6" />
              </div>
              <div>
                <h4 className="text-white font-bold text-sm">Role-Based Access</h4>
                <p className="text-indigo-200 text-xs mt-1">Akses yang aman dan terfilter berdasarkan peran (Admin, Kasir, atau Koki).</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side (Form) */}
        <div className="w-full lg:w-1/2 p-8 sm:p-12 bg-white relative">
          <AnimatePresence mode="wait">
            {isLoginView ? (
              <motion.div 
                key="login"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="h-full flex flex-col justify-center"
              >
                <div className="mb-8">
                  <h2 className="text-2xl font-bold text-slate-900">Selamat Datang Kembali</h2>
                  <p className="text-slate-500 text-sm mt-1">Silakan masuk ke akun staf Anda</p>
                </div>

                {errorMsg && (
                  <div className="p-3 mb-6 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    {errorMsg}
                  </div>
                )}

                <form onSubmit={handleLogin} className="space-y-5">
                  <div>
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 block">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-900"
                        placeholder="admin@gmail.com"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 block">Kata Sandi</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-10 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-900"
                        placeholder="••••••••"
                      />
                      <button 
                        type="button" 
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    disabled={isLoading}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-3 text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-70"
                  >
                    {isLoading ? (
                      <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>Masuk ke Dasbor <LogIn className="w-4 h-4" /></>
                    )}
                  </button>
                </form>

                <div className="mt-8 text-center text-sm text-slate-500">
                  Staf baru belum punya akun?{' '}
                  <button onClick={() => setIsLoginView(false)} className="text-indigo-600 font-bold hover:underline">
                    Daftar di sini
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="register"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="h-full flex flex-col justify-center"
              >
                <div className="mb-8">
                  <h2 className="text-2xl font-bold text-slate-900">Registrasi Staf Baru</h2>
                  <p className="text-slate-500 text-sm mt-1">Buat akun untuk masuk ke dalam tim</p>
                </div>

                {errorMsg && (
                  <div className="p-3 mb-6 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    {errorMsg}
                  </div>
                )}

                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 block">Nama Lengkap</label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input type="text" required value={regName} onChange={(e) => setRegName(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500 text-slate-900" placeholder="Budi Santoso" />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 block">Peran (Role)</label>
                      <select value={regRole} onChange={(e) => setRegRole(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500 text-slate-900">
                        <option value="Kasir">Kasir</option>
                        <option value="Koki">Koki</option>
                        <option value="Super Admin">Super Admin</option>
                        <option value="Support">Support</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 block">Email</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input type="email" required value={regEmail} onChange={(e) => setRegEmail(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500 text-slate-900" placeholder="email@contoh.com" />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 block">No. Telepon (Opsional)</label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input type="text" value={regPhone} onChange={(e) => setRegPhone(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500 text-slate-900" placeholder="08..." />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 block">Buat Kata Sandi</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input type={showPassword ? 'text' : 'password'} required value={regPassword} onChange={(e) => setRegPassword(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-9 py-2.5 text-sm focus:outline-none focus:border-indigo-500 text-slate-900" placeholder="••••••••" />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    disabled={isLoading}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-xl py-3 text-sm font-bold flex items-center justify-center gap-2 mt-2 transition-all disabled:opacity-70"
                  >
                    {isLoading ? (
                      <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>Daftar Akun <UserPlus className="w-4 h-4" /></>
                    )}
                  </button>
                </form>

                <div className="mt-8 text-center text-sm text-slate-500">
                  Sudah memiliki akun?{' '}
                  <button onClick={() => setIsLoginView(true)} className="text-indigo-600 font-bold hover:underline">
                    Masuk di sini
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
