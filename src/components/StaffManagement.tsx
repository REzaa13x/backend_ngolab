import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  Users, 
  UserPlus, 
  Search, 
  Calendar, 
  Clock, 
  MoreVertical, 
  Mail, 
  Phone, 
  Shield, 
  ChefHat, 
  Store,
  CheckCircle2,
  Filter,
  Wrench,
  UserCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/src/lib/utils';
import { authFetch } from '../lib/authFetch';

interface Staff {
  id: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  status: string;
  password_plain?: string | null;
}

interface Shift {
  id: number;
  staff_id: string;
  name: string;
  role: string;
  shift_type: string;
  time: string;
  date: string;
}

export default function StaffManagement() {
  const { user } = useAuth();
  void user;
  const [activeTab, setActiveTab] = useState<'roster' | 'shifts'>('roster');
  const [staff, setStaff] = useState<Staff[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'Semua' | 'Super Admin' | 'Kasir' | 'Koki' | 'Support'>('Semua');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [staffRes, shiftRes] = await Promise.all([
          authFetch('/api/staff'),
          authFetch('/api/shifts')
        ]);
        setStaff(await staffRes.json());
        setShifts(await shiftRes.json());
      } catch (err) {
        console.error("Failed to fetch staff data", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const [isAssigning, setIsAssigning] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isEditingStaff, setIsEditingStaff] = useState(false);
  const [newShift, setNewShift] = useState({ staff_id: '', shift_type: 'Pagi', time: '08:00 - 16:00' });
  const [newStaff, setNewStaff] = useState({ name: '', role: 'Kasir', email: '', phone: '', password: '' });
  const [toast, setToast] = useState('');
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [editPassword, setEditPassword] = useState('');
  const [actionError, setActionError] = useState('');

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 3500);
  };

  const handleRegisterStaff = async () => {
    if (!newStaff.name || !newStaff.email || newStaff.password.length < 6) return;
    setActionError('');
    try {
      const res = await authFetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newStaff)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionError(data.message || 'Gagal mendaftarkan pegawai');
        return;
      }
      setStaff([data, ...staff]);
      setIsRegistering(false);
      setNewStaff({ name: '', role: 'Kasir', email: '', phone: '', password: '' });
      showToast(`Pegawai ${data.name} terdaftar. Password: ${data.password_plain}`);
    } catch (err) {
      console.error("Failed to register staff", err);
      setActionError('Terjadi kesalahan koneksi');
    }
  };

  const handleUpdateStaff = async () => {
    if (!editingStaff) return;
    setActionError('');
    try {
      const payload: any = { ...editingStaff };
      if (editPassword) payload.password = editPassword;
      const res = await authFetch(`/api/staff/${editingStaff.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionError(data.message || 'Gagal menyimpan perubahan');
        return;
      }
      setStaff(staff.map(s => s.id === data.id ? data : s));
      setIsEditingStaff(false);
      setEditPassword('');
      showToast('Data pegawai tersimpan');
    } catch (err) {
      console.error("Failed to update staff", err);
      setActionError('Terjadi kesalahan koneksi');
    }
  };

  const handleDeleteStaff = async () => {
    if (!editingStaff) return;
    setActionError('');
    try {
      const res = await authFetch(`/api/staff/${editingStaff.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionError(data.message || 'Gagal menghapus pegawai');
        return;
      }
      setStaff(staff.filter(s => s.id !== editingStaff.id));
      setIsEditingStaff(false);
      showToast('Pegawai dihapus');
    } catch (err) {
      console.error("Failed to delete staff", err);
      setActionError('Terjadi kesalahan koneksi');
    }
  };


  const handleAssignShift = async () => {
    if (!newShift.staff_id) return;
    setActionError('');
    try {
      const res = await authFetch('/api/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newShift)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionError(data.message || 'Gagal menetapkan shift');
        return;
      }
      setShifts([...shifts, data]);
      setIsAssigning(false);
      showToast(`Shift ${data.name} ditetapkan`);
    } catch (err) {
      console.error("Failed to assign shift", err);
      setActionError('Terjadi kesalahan koneksi');
    }
  };

  const filteredStaff = staff.filter(s => 
    (roleFilter === 'Semua' || s.role === roleFilter) &&
    (s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
     s.role.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      {/* Toast */}
      {toast && (
        <div className="fixed top-6 right-6 z-[120] bg-indigo-600 text-white px-5 py-3 rounded-xl shadow-lg text-sm font-bold flex items-center gap-2">
          <CheckCircle2 size={16} /> {toast}
        </div>
      )}

      {/* Modal Registrasi Pegawai */}
      {isRegistering && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl border border-slate-100"
          >
            <div className="mb-6 text-center">
              <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <UserPlus size={32} />
              </div>
              <h3 className="text-xl font-black text-slate-900">Registrasi Pegawai Baru</h3>
              <p className="text-sm text-slate-500 font-medium">Tambahkan anggota tim baru ke dalam sistem.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-2">Nama Lengkap</label>
                <input 
                  type="text" 
                  placeholder="Contoh: Budi Sudarsono"
                  className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-indigo-600 outline-none"
                  value={newStaff.name}
                  onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })}
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-2">Jabatan / Role</label>
                <select 
                  className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-indigo-600 outline-none"
                  value={newStaff.role}
                  onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value })}
                >
                  <option value="Kasir">Kasir</option>
                  <option value="Koki">Koki</option>
                  <option value="Support">Support</option>
                  <option value="Super Admin">Super Admin</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-2">Email</label>
                  <input 
                    type="email" 
                    placeholder="budi@ais.com"
                    className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-indigo-600 outline-none"
                    value={newStaff.email}
                    onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-2">No. HP</label>
                  <input 
                    type="tel" 
                    placeholder="0812..."
                    className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-indigo-600 outline-none"
                    value={newStaff.phone}
                    onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-2">Password Awal *</label>
                <input
                  type="text"
                  placeholder="Minimal 6 karakter"
                  className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-indigo-600 outline-none"
                  value={newStaff.password}
                  onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })}
                />
                <p className="text-[10px] text-slate-400 font-medium mt-1.5 pl-1">
                  Password ini yang dipakai pegawai untuk login. Catat dan berikan ke pegawai.
                </p>
              </div>

              {actionError && (
                <p className="text-[11px] font-bold text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-4 py-3">{actionError}</p>
              )}

              <div className="pt-4 flex gap-3">
                <button
                  onClick={() => { setIsRegistering(false); setActionError(''); }}
                  className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                  Batal
                </button>
                <button
                  onClick={handleRegisterStaff}
                  disabled={!newStaff.name || !newStaff.email || newStaff.password.length < 6}
                  className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 dark:shadow-none disabled:opacity-50"
                >
                  Daftarkan Sekarang
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal Edit Pegawai */}
      {isEditingStaff && editingStaff && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl border border-slate-100"
          >
            <div className="mb-6 text-center">
              <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <UserCircle size={32} />
              </div>
              <h3 className="text-xl font-black text-slate-900">Perbarui Data Pegawai</h3>
              <p className="text-sm text-slate-500 font-medium">Ubah jabatan, kontak, atau password pegawai.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-2">Nama Lengkap</label>
                <input 
                  type="text" 
                  className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-blue-600 outline-none"
                  value={editingStaff.name}
                  onChange={(e) => setEditingStaff({ ...editingStaff, name: e.target.value })}
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-2">Jabatan / Role</label>
                <select 
                  className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-blue-600 outline-none"
                  value={editingStaff.role}
                  onChange={(e) => setEditingStaff({ ...editingStaff, role: e.target.value })}
                >
                  <option value="Kasir">Kasir</option>
                  <option value="Koki">Koki</option>
                  <option value="Support">Support</option>
                  <option value="Super Admin">Super Admin</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-2">Email</label>
                  <input 
                    type="email" 
                    className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-blue-600 outline-none"
                    value={editingStaff.email}
                    onChange={(e) => setEditingStaff({ ...editingStaff, email: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-2">No. HP</label>
                  <input 
                    type="tel" 
                    className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-blue-600 outline-none"
                    value={editingStaff.phone}
                    onChange={(e) => setEditingStaff({ ...editingStaff, phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Password Saat Ini</p>
                <p className="font-mono text-sm font-bold text-slate-900">
                  {editingStaff.password_plain || '— (akun lama, belum tercatat)'}
                </p>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-2">Password Baru (opsional)</label>
                <input
                  type="text"
                  placeholder="Kosongkan bila tidak diganti"
                  className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-blue-600 outline-none"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                />
              </div>

              {actionError && (
                <p className="text-[11px] font-bold text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-4 py-3">{actionError}</p>
              )}

              <div className="pt-4 flex gap-3">
                <button
                  onClick={() => { setIsEditingStaff(false); setEditPassword(''); setActionError(''); }}
                  className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                  Batal
                </button>
                <button
                  onClick={handleDeleteStaff}
                  className="flex-1 py-4 bg-rose-50 text-rose-600 border border-rose-100 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-rose-100 transition-all"
                >
                  Hapus
                </button>
                <button
                  onClick={handleUpdateStaff}
                  className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 dark:shadow-none"
                >
                  Simpan
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal Tetapkan Shift */}
      {isAssigning && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl border border-slate-100"
          >
            <div className="mb-6">
              <h3 className="text-xl font-black text-slate-900">Atur Jadwal Kerja</h3>
              <p className="text-sm text-slate-500 font-medium">Tugaskan staf untuk sesi shift tertentu hari ini.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-2">Pilih Pegawai</label>
                <select 
                  className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-indigo-600 outline-none"
                  value={newShift.staff_id}
                  onChange={(e) => setNewShift({ ...newShift, staff_id: e.target.value })}
                >
                  <option value="">-- Pilih Staf --</option>
                  {staff.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-2">Tipe Shift</label>
                  <select 
                    className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-indigo-600 outline-none"
                    value={newShift.shift_type}
                    onChange={(e) => setNewShift({ ...newShift, shift_type: e.target.value })}
                  >
                    <option value="Pagi">Pagi</option>
                    <option value="Siang">Siang</option>
                    <option value="Malam">Malam</option>
                    <option value="Full Day">Full Day</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-2">Jam (Range)</label>
                  <input 
                    type="text" 
                    placeholder="08:00 - 16:00"
                    className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-indigo-600 outline-none"
                    value={newShift.time}
                    onChange={(e) => setNewShift({ ...newShift, time: e.target.value })}
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  onClick={() => setIsAssigning(false)}
                  className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-all font-bold"
                >
                  Batal
                </button>
                <button
                  onClick={handleAssignShift}
                  disabled={!newShift.staff_id}
                  className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 dark:shadow-none disabled:opacity-50"
                >
                  Simpan Jadwal
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-slate-900">Manajemen Tim & Kepegawaian</h2>
          <p className="text-sm text-slate-500 font-medium tracking-tight">Registrasi pegawai dan pengaturan jadwal tugas harian.</p>
        </div>
        <div className="flex items-center gap-2">
           <button 
             onClick={() => setIsAssigning(true)}
             className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 dark:shadow-none"
           >
              <Calendar size={16} /> Tetapkan Shift
           </button>
           <button 
             onClick={() => setIsRegistering(true)}
             className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-black transition-all shadow-lg shadow-slate-200 dark:shadow-none"
           >
              <UserPlus size={16} /> Registrasi Pegawai
           </button>
        </div>
      </div>

      {/* Tabs Control */}
      <div className="flex bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-slate-100 dark:border-slate-800 p-1 rounded-2xl w-fit shadow-sm">
        <button 
          onClick={() => setActiveTab('roster')}
          className={cn(
            "px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
            activeTab === 'roster' ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-orange-500 shadow-sm dark:shadow-none" : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
          )}
        >
          <Users size={14} /> Daftar Pegawai
        </button>
        <button 
          onClick={() => setActiveTab('shifts')}
          className={cn(
            "px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
            activeTab === 'shifts' ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-orange-500 shadow-sm dark:shadow-none" : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
          )}
        >
          <Calendar size={14} /> Jadwal Shift Hari Ini
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'roster' ? (
          <motion.div 
            key="roster"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <div className="flex flex-col sm:flex-row gap-4">
               <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input 
                    type="text" 
                    placeholder="Cari nama atau posisi (Kasir, Koki, dll)..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-white border border-slate-100 rounded-2xl pl-12 pr-4 py-3 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-sm"
                  />
               </div>
               <div className="flex items-center gap-2">
                 <Filter size={16} className="text-slate-400" />
                 <select
                   value={roleFilter}
                   onChange={(e) => setRoleFilter(e.target.value as typeof roleFilter)}
                   className="bg-transparent text-[10px] font-black uppercase tracking-widest text-slate-500 focus:outline-none cursor-pointer"
                 >
                   <option value="Semua">Semua Jabatan</option>
                   <option value="Super Admin">Super Admin</option>
                   <option value="Kasir">Kasir</option>
                   <option value="Koki">Koki</option>
                   <option value="Support">Support</option>
                 </select>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredStaff.map((person) => (
                <div key={person.id} className="bg-white rounded-[2rem] border border-slate-100 p-6 shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all relative overflow-hidden group">
                   <div className="absolute top-0 right-0 w-24 h-24 bg-slate-50 rounded-full -mr-12 -mt-12 transition-all group-hover:bg-indigo-50" />
                   
                   <div className="flex items-start justify-between relative z-10">
                      <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-12 h-12 rounded-2xl flex items-center justify-center transition-colors",
                            (person.role === 'Super Admin' || person.role === 'Admin') ? "bg-indigo-50 text-indigo-600" :
                            person.role === 'Kasir' ? "text-emerald-600 bg-emerald-50" :
                            person.role === 'Koki' ? "text-amber-600 bg-amber-50" :
                            "text-blue-600 bg-blue-50"
                          )}>
                             {(person.role === 'Super Admin' || person.role === 'Admin') ? <Shield size={24} /> :
                              person.role === 'Kasir' ? <Store size={24} /> :
                              person.role === 'Koki' ? <ChefHat size={24} /> :
                              <Wrench size={24} />}
                          </div>
                         <div>
                            <h3 className="font-black text-slate-900 group-hover:text-indigo-600 transition-colors">{person.name}</h3>
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{person.role}</span>
                         </div>
                      </div>
                      <button
                        onClick={() => {
                          setEditingStaff(person);
                          setEditPassword('');
                          setActionError('');
                          setIsEditingStaff(true);
                        }}
                        title="Kelola pegawai"
                        className="text-slate-300 hover:text-slate-600 p-1"
                      >
                         <MoreVertical size={20} />
                      </button>
                   </div>

                   <div className="mt-6 space-y-3 relative z-10">
                      <div className="flex items-center gap-3 text-xs text-slate-500">
                         <Mail size={14} className="text-slate-300" />
                         {person.email}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500">
                         <Phone size={14} className="text-slate-300" />
                         {person.phone || '-'}
                      </div>
                      <div className="flex items-center justify-between gap-3 text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
                         <span className="font-bold uppercase text-[9px] tracking-widest text-slate-400">Password</span>
                         <span className="font-mono font-bold text-slate-800">{person.password_plain || '—'}</span>
                      </div>
                   </div>

                   <div className="mt-6 pt-6 border-t border-slate-50 flex items-center justify-between relative z-10">
                      <div className="flex items-center gap-1.5">
                         <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                         <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Terdaftar</span>
                      </div>
                      <span className="text-[10px] font-bold text-slate-300">ID: {person.id}</span>
                   </div>
                </div>
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="shifts"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-white rounded-[2rem] border border-slate-100 shadow-xl overflow-hidden"
          >
            <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
               <div>
                  <h3 className="font-black text-slate-900 flex items-center gap-2">
                     <Clock className="text-indigo-600" size={18} />
                     Jadwal Tugas Harian
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-1">Status kehadiran personil yang bertugas saat ini.</p>
               </div>
               <div className="text-right">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Tanggal</span>
                  <span className="text-xs font-bold text-slate-900">{new Date().toLocaleDateString('id-ID', { dateStyle: 'full' })}</span>
               </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-300  dark: text-[10px] font-black uppercase tracking-widest  border-b border-slate-50">
                    <th className="px-8 py-5">Staf</th>
                    <th className="px-8 py-5">Jabatan</th>
                    <th className="px-8 py-5">Sesi Shift</th>
                    <th className="px-8 py-5">Jam Bertugas</th>
                    <th className="px-8 py-5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {shifts.map((shift) => (
                    <tr key={shift.id} className="hover:bg-slate-50/30 transition-colors">
                      <td className="px-8 py-5">
                         <span className="text-sm font-black text-slate-900">{shift.name}</span>
                         <span className="text-[10px] text-slate-400 block font-bold">ID: {shift.staff_id}</span>
                      </td>
                      <td className="px-8 py-5">
                          <span className={cn(
                            "px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter",
                            (shift.role === 'Super Admin' || shift.role === 'Admin') ? "bg-indigo-50 text-indigo-600" :
                            shift.role === 'Kasir' ? "text-emerald-600 bg-emerald-50" :
                            shift.role === 'Koki' ? "text-amber-600 bg-amber-50" :
                            "text-blue-600 bg-blue-50"
                          )}>
                             {shift.role}
                          </span>
                      </td>
                      <td className="px-8 py-5">
                         <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-600">{shift.shift_type}</span>
                         </div>
                      </td>
                      <td className="px-8 py-5">
                         <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                            {shift.time}
                         </div>
                      </td>
                      <td className="px-8 py-5 text-right">
                         <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-black uppercase tracking-widest border border-emerald-100">
                            <CheckCircle2 size={10} /> Active
                         </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="p-6 bg-slate-50/30 border-t border-slate-50 flex items-center justify-between">
               <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                     <div className="w-2 h-2 rounded-full bg-emerald-500" />
                     <span className="text-[10px] font-bold text-slate-400 uppercase">Kasir Online</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                     <div className="w-2 h-2 rounded-full bg-amber-500" />
                     <span className="text-[10px] font-bold text-slate-400 uppercase">Koki Standby</span>
                  </div>
               </div>
               <button className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline">
                  Atur Ulang Jadwal Besok
               </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
