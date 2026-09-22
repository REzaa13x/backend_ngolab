import React, { useEffect, useState } from 'react';
import { 
  Search, 
  MoreVertical, 
  Plus, 
  Wallet,
  ArrowUpRight,
  UserPlus,
  X,
  Coins,
  CheckCircle2,
  Mail,
  Phone,
  Ticket,
  KeyRound,
  Eye,
  EyeOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/src/lib/utils';
import { authFetch } from '../lib/authFetch';

interface User {
  id: string;
  nama: string;
  nim: string;
  coin_balance: number;
  avatar_url: string;
  email?: string;
  phone?: string;
  role?: string;
  password?: string;
  password_plain?: string;
  active_vouchers_count?: number;
  created_at?: string;
}

const getRoleBadgeColor = (role?: string) => {
  switch (role) {
    case 'Siswa':
    case 'Mahasiswa':
      return 'bg-blue-50 text-blue-600 border-blue-100';
    case 'Dosen':
    case 'Staff':
      return 'bg-emerald-50 text-emerald-600 border-emerald-100';
    case 'Super Admin':
    case 'Admin':
      return 'bg-rose-50 text-rose-600 border-rose-100';
    default:
      return 'bg-slate-50 text-slate-600 border-slate-200';
  }
};

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Add User Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [formData, setFormData] = useState({ id: '', nama: '', nim: '', avatar_url: '', email: '', phone: '', role: 'Pelanggan', password: '' });
  const [isSaving, setIsSaving] = useState(false);

  // Add Coins Modal State
  const [selectedUserForCoins, setSelectedUserForCoins] = useState<User | null>(null);
  const [coinAmount, setCoinAmount] = useState('');
  const [coinDescription, setCoinDescription] = useState('Hadiah koin dari aktivitas game/kiosk');
  const [isSavingCoins, setIsSavingCoins] = useState(false);

  const [toast, setToast] = useState('');

  // Edit / aktivitas pengguna
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ nama: '', nim: '', email: '', phone: '', avatar_url: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [revealedPasswordId, setRevealedPasswordId] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [activity, setActivity] = useState<any[] | null>(null);
  const [isLoadingActivity, setIsLoadingActivity] = useState(false);

  const fetchUsers = () => {
    authFetch('/api/users')
      .then(res => res.json())
      .then(data => setUsers(Array.isArray(data) ? data : []))
      .catch(err => console.error("Gagal mengambil data user:", err));
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.id || !formData.nama) return;
    setIsSaving(true);

    try {
      const res = await authFetch('/api/users/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (res.ok) {
        setIsAddModalOpen(false);
        setFormData({ id: '', nama: '', nim: '', avatar_url: '', email: '', phone: '', role: 'Pelanggan', password: '' });
        fetchUsers();
        showToast('Pengguna berhasil didaftarkan!');
      } else {
        alert(data.message || 'Gagal mendaftarkan pengguna');
      }
    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan koneksi');
    } finally {
      setIsSaving(false);
    }
  };

  const openUserManager = (user: User) => {
    setEditingUser(user);
    setEditForm({
      nama: user.nama || '',
      nim: user.nim || '',
      email: user.email || '',
      phone: user.phone || '',
      avatar_url: user.avatar_url || '',
      password: ''
    });
    setShowPassword(false);
    setActivity(null);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setIsSavingEdit(true);
    try {
      const payload: any = { nama: editForm.nama, nim: editForm.nim, email: editForm.email, phone: editForm.phone, avatar_url: editForm.avatar_url };
      if (editForm.password) payload.password = editForm.password;
      const res = await authFetch(`/api/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.message || 'Gagal menyimpan data pengguna');
        return;
      }
      setEditingUser(null);
      fetchUsers();
      showToast('Data pengguna tersimpan!');
    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan koneksi');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const loadActivity = async (user: User) => {
    setIsLoadingActivity(true);
    try {
      const res = await authFetch(`/api/users/transactions?user_id=${encodeURIComponent(user.id)}`);
      const data = await res.json().catch(() => []);
      setActivity(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Gagal mengambil aktivitas:', err);
      setActivity([]);
    } finally {
      setIsLoadingActivity(false);
    }
  };

  const handleAddCoins = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForCoins || !coinAmount) return;
    setIsSavingCoins(true);

    try {
      const res = await authFetch(`/api/users/${selectedUserForCoins.id}/earn-coins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: parseInt(coinAmount), description: coinDescription })
      });
      const data = await res.json();
      if (res.ok) {
        setSelectedUserForCoins(null);
        setCoinAmount('');
        setCoinDescription('Hadiah koin dari aktivitas game/kiosk');
        fetchUsers();
        showToast('Koin berhasil ditambahkan!');
      } else {
        alert(data.message || 'Gagal menambahkan koin');
      }
    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan koneksi');
    } finally {
      setIsSavingCoins(false);
    }
  };

  const filteredUsers = users.filter(user => 
    user.nama.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.nim.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.email && user.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (user.phone && user.phone.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (user.role && user.role.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Alert */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: -20 }} 
            className="fixed top-6 right-6 z-[120] bg-indigo-600 text-white px-5 py-3 rounded-xl shadow-lg text-sm font-bold flex items-center gap-2"
          >
            <CheckCircle2 size={16}/> {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Database Pengguna</h2>
          <p className="text-sm text-slate-500 font-medium">Kelola akun siswa, perolehan koin, dan riwayat aktivitas game.</p>
        </div>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 px-5 py-3 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-lg hover:shadow-indigo-200 dark:shadow-none"
        >
          <UserPlus size={16} />
          Tambah Pengguna Baru
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative flex-1 group w-full max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 transition-colors" />
        <input
          type="text"
          placeholder="Cari berdasarkan nama atau NIM..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full bg-white border border-slate-100 rounded-2xl pl-12 pr-4 py-3.5 text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium shadow-sm"
        />
      </div>

      {/* User Grid */}
      {filteredUsers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400 bg-white rounded-3xl border border-slate-50 shadow-sm">
          <UserPlus size={48} className="mb-4 opacity-30" />
          <p className="font-bold text-sm">Pengguna tidak ditemukan</p>
          <p className="text-xs mt-1">Coba cari dengan kata kunci lain atau daftarkan pengguna baru.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredUsers.map((user, i) => (
            <motion.div
              key={user.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white p-6 rounded-2xl border border-slate-100 shadow-premium group hover:border-indigo-100 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <img 
                      src={user.avatar_url} 
                      alt={user.nama} 
                      className="w-12 h-12 rounded-xl object-cover border border-slate-100"
                      referrerPolicy="no-referrer"
                      onError={e => {
                        (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${user.id}/100/100`;
                      }}
                    />
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h3 className="text-sm font-bold text-slate-900 leading-tight">{user.nama}</h3>
                        <span className={`px-2 py-0.5 text-[9px] font-black uppercase rounded-md border ${getRoleBadgeColor(user.role)}`}>
                          {user.role || 'Pelanggan'}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">NIM / ID: {user.nim}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => openUserManager(user)}
                    title="Kelola pengguna"
                    className="p-1.5 text-slate-300 hover:text-slate-600 transition-colors"
                  >
                    <MoreVertical size={16} />
                  </button>
                </div>

                {/* Contact Info (Email / Telepon) */}
                <div className="space-y-1.5 my-4 pt-1">
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 font-semibold truncate" title={user.email || 'Tidak ada email'}>
                    <Mail size={13} className="text-slate-400 flex-shrink-0" />
                    <span className="truncate">{user.email || '-'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 font-semibold">
                    <Phone size={13} className="text-slate-400 flex-shrink-0" />
                    <span>{user.phone || '-'}</span>
                  </div>
                </div>

                {/* Password akun pelanggan, dapat dibaca staf */}
                <div className="flex items-center justify-between gap-3 bg-slate-50 rounded-xl px-3.5 py-2.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-lg bg-white border border-slate-100 text-slate-500 shrink-0">
                      <KeyRound size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Password Akun</p>
                      <p className="text-xs font-mono font-bold text-slate-900 truncate">
                        {!user.password_plain
                          ? '—'
                          : revealedPasswordId === user.id
                            ? user.password_plain
                            : '•'.repeat(Math.min(user.password_plain.length, 12))}
                      </p>
                    </div>
                  </div>
                  {user.password_plain && (
                    <button
                      type="button"
                      onClick={() => setRevealedPasswordId(revealedPasswordId === user.id ? null : user.id)}
                      title={revealedPasswordId === user.id ? 'Sembunyikan password' : 'Tampilkan password'}
                      className="p-1.5 bg-white border border-slate-100 rounded-lg text-slate-400 hover:text-indigo-600 hover:border-indigo-100 transition-all shadow-sm shrink-0"
                    >
                      {revealedPasswordId === user.id ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  )}
                </div>

                {/* Koin & Voucher Container */}
                <div className="space-y-2.5">
                  <div className="bg-slate-50 rounded-xl p-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-white border border-slate-100 text-indigo-600">
                        <Wallet size={16} />
                      </div>
                      <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Saldo Koin Game</p>
                        <p className="text-sm font-extrabold text-slate-900">{user.coin_balance.toLocaleString()}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setSelectedUserForCoins(user)}
                      title="Tambah Koin Manual"
                      className="p-1.5 bg-white border border-slate-100 rounded-lg text-slate-400 hover:text-indigo-600 hover:border-indigo-100 transition-all shadow-sm"
                    >
                      <Plus size={14} />
                    </button>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-white border border-slate-100 text-amber-500">
                        <Ticket size={16} />
                      </div>
                      <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Voucher Aktif</p>
                        <p className="text-xs font-bold text-slate-900 mt-0.5">
                          {user.active_vouchers_count && user.active_vouchers_count > 0 ? (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-md text-[10px] font-black uppercase">
                              {user.active_vouchers_count} Voucher Aktif
                            </span>
                          ) : (
                            <span className="text-slate-400">0 Voucher Aktif</span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                <div className="text-[10px] text-slate-400 font-semibold">
                  Terdaftar: {user.created_at ? new Date(user.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                </div>
                <button
                  onClick={() => openUserManager(user)}
                  className="text-[10px] font-bold text-indigo-600 hover:underline flex items-center gap-1"
                >
                  Lihat Aktivitas <ArrowUpRight size={10} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* ═══════════════════ ADD USER MODAL ═══════════════════ */}
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
              className="relative w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl p-8 overflow-y-auto max-h-[90vh]"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Registrasi Pengguna Baru</h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">Daftarkan akun pelanggan baru.</p>
                </div>
                <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X size={22} className="text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleAddUser} className="space-y-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">User ID / NIM *</label>
                  <input
                    required 
                    type="text" 
                    value={formData.id}
                    onChange={e => setFormData({ ...formData, id: e.target.value, nim: e.target.value })}
                    placeholder="Contoh: 1301210001"
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Nama Lengkap *</label>
                  <input
                    required 
                    type="text" 
                    value={formData.nama}
                    onChange={e => setFormData({ ...formData, nama: e.target.value })}
                    placeholder="Contoh: Ahmad Fauzi"
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Email (Opsional)</label>
                  <input
                    type="email" 
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    placeholder="ahmad@gmail.com"
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Nomor Telepon (Opsional)</label>
                  <input
                    type="tel" 
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="08123456789"
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Password (Opsional)</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Masukkan password akun"
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Role / Peran</label>
                  <select 
                    value={formData.role}
                    onChange={e => setFormData({ ...formData, role: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium text-slate-700"
                  >
                    <option value="Pelanggan">Pelanggan (Umum)</option>
                    <option value="Siswa">Siswa</option>
                    <option value="Mahasiswa">Mahasiswa</option>
                    <option value="Dosen">Dosen</option>
                    <option value="Staff">Staff</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Avatar URL (Opsional)</label>
                  <input
                    type="text" 
                    value={formData.avatar_url}
                    onChange={e => setFormData({ ...formData, avatar_url: e.target.value })}
                    placeholder="https://..."
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button 
                    type="button" 
                    onClick={() => setIsAddModalOpen(false)}
                    className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit" 
                    disabled={isSaving}
                    className="flex-[2] py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:shadow-indigo-200 dark:shadow-none transition-all disabled:opacity-60"
                  >
                    {isSaving ? 'Mendaftarkan...' : 'Daftarkan'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ═══════════════════ KELOLA PENGGUNA MODAL ═══════════════════ */}
      <AnimatePresence>
        {editingUser && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setEditingUser(null)}
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
                  <h3 className="text-xl font-bold text-slate-900">Kelola Pengguna</h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">{editingUser.nama} &middot; ID {editingUser.id}</p>
                </div>
                <button onClick={() => setEditingUser(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X size={22} className="text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleUpdateUser} className="space-y-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Nama Lengkap</label>
                  <input required type="text" value={editForm.nama}
                    onChange={e => setEditForm({ ...editForm, nama: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">NIM / ID</label>
                    <input type="text" value={editForm.nim}
                      onChange={e => setEditForm({ ...editForm, nim: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">No. Telepon</label>
                    <input type="tel" value={editForm.phone}
                      onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Email</label>
                  <input type="email" value={editForm.email}
                    onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Avatar URL</label>
                  <input type="text" value={editForm.avatar_url}
                    onChange={e => setEditForm({ ...editForm, avatar_url: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
                </div>

                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Password Saat Ini</p>
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-mono text-sm font-bold text-slate-900">
                      {!editingUser.password_plain
                        ? '— (belum tercatat)'
                        : showPassword
                          ? editingUser.password_plain
                          : '•'.repeat(Math.min(editingUser.password_plain.length, 12))}
                    </p>
                    {editingUser.password_plain && (
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="p-1.5 bg-white border border-slate-100 rounded-lg text-slate-400 hover:text-indigo-600 transition-all"
                      >
                        {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Password Baru (opsional)</label>
                  <input type="text" value={editForm.password}
                    onChange={e => setEditForm({ ...editForm, password: e.target.value })}
                    placeholder="Kosongkan bila tidak diganti"
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setEditingUser(null)}
                    className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest">
                    Batal
                  </button>
                  <button type="submit" disabled={isSavingEdit}
                    className="flex-[2] py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-60">
                    {isSavingEdit ? 'Menyimpan...' : 'Simpan Perubahan'}
                  </button>
                </div>
              </form>

              <div className="mt-8 pt-6 border-t border-slate-100">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Coins size={16} className="text-amber-500" /> Riwayat Aktivitas Koin
                  </h4>
                  <button
                    type="button"
                    onClick={() => loadActivity(editingUser)}
                    disabled={isLoadingActivity}
                    className="text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:underline disabled:opacity-50"
                  >
                    {isLoadingActivity ? 'Memuat...' : 'Muat Aktivitas'}
                  </button>
                </div>
                {activity === null ? (
                  <p className="text-xs text-slate-400">Tekan "Muat Aktivitas" untuk melihat riwayat perolehan koin pengguna ini.</p>
                ) : activity.length === 0 ? (
                  <p className="text-xs text-slate-400">Belum ada aktivitas koin.</p>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto">
                    {activity.slice(0, 20).map((tx: any) => (
                      <div key={tx.id} className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-2.5">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 truncate">{tx.description || 'Tanpa keterangan'}</p>
                          <p className="text-[10px] text-slate-400 font-medium">
                            {tx.created_at ? new Date(tx.created_at).toLocaleString('id-ID') : '-'}
                          </p>
                        </div>
                        <span className={cn(
                          'text-xs font-black shrink-0 ml-3',
                          tx.type === 'spend' ? 'text-rose-600' : 'text-emerald-600'
                        )}>
                          {tx.type === 'spend' ? '-' : '+'}{Number(tx.amount || 0).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ═══════════════════ ADD COINS MODAL ═══════════════════ */}
      <AnimatePresence>
        {selectedUserForCoins && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelectedUserForCoins(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl p-8 overflow-y-auto max-h-[90vh]"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <Coins className="text-amber-500" size={24} />
                    Tambah Koin Manual
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">Kirim koin ke {selectedUserForCoins.nama}.</p>
                </div>
                <button onClick={() => setSelectedUserForCoins(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X size={22} className="text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleAddCoins} className="space-y-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Jumlah Koin *</label>
                  <input
                    required 
                    type="number" 
                    min={1}
                    value={coinAmount}
                    onChange={e => setCoinAmount(e.target.value)}
                    placeholder="Contoh: 500"
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Deskripsi / Keterangan *</label>
                  <textarea 
                    required
                    value={coinDescription}
                    onChange={e => setCoinDescription(e.target.value)}
                    placeholder="Contoh: Hadiah koin dari aktivitas game/kiosk"
                    rows={3}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button 
                    type="button" 
                    onClick={() => setSelectedUserForCoins(null)}
                    className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit" 
                    disabled={isSavingCoins}
                    className="flex-[2] py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:shadow-indigo-200 dark:shadow-none transition-all disabled:opacity-60"
                  >
                    {isSavingCoins ? 'Menambahkan...' : 'Tambah Koin'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
