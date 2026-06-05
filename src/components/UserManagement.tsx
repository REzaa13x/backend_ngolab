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
  Ticket
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface User {
  id: string;
  nama: string;
  nim: string;
  coin_balance: number;
  avatar_url: string;
  email?: string;
  phone?: string;
  role?: string;
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
  const [formData, setFormData] = useState({ id: '', nama: '', nim: '', avatar_url: '', email: '', phone: '', role: 'Pelanggan' });
  const [isSaving, setIsSaving] = useState(false);

  // Add Coins Modal State
  const [selectedUserForCoins, setSelectedUserForCoins] = useState<User | null>(null);
  const [coinAmount, setCoinAmount] = useState('');
  const [coinDescription, setCoinDescription] = useState('Hadiah koin dari aktivitas game/kiosk');
  const [isSavingCoins, setIsSavingCoins] = useState(false);

  const [toast, setToast] = useState('');

  const fetchUsers = () => {
    fetch('/api/users')
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
      const res = await fetch('/api/users/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (res.ok) {
        setIsAddModalOpen(false);
        setFormData({ id: '', nama: '', nim: '', avatar_url: '', email: '', phone: '', role: 'Pelanggan' });
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

  const handleAddCoins = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForCoins || !coinAmount) return;
    setIsSavingCoins(true);

    try {
      const res = await fetch(`/api/users/${selectedUserForCoins.id}/earn-coins`, {
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
          className="flex items-center gap-2 px-5 py-3 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-lg hover:shadow-indigo-200"
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
                  <button className="p-1.5 text-slate-300 hover:text-slate-600 transition-colors">
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
                <button className="text-[10px] font-bold text-indigo-600 hover:underline flex items-center gap-1">
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
                    className="flex-[2] py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:shadow-indigo-200 transition-all disabled:opacity-60"
                  >
                    {isSaving ? 'Mendaftarkan...' : 'Daftarkan'}
                  </button>
                </div>
              </form>
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
                    className="flex-[2] py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:shadow-indigo-200 transition-all disabled:opacity-60"
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
