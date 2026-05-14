import React, { useEffect, useState } from 'react';
import { 
  Search, 
  MoreVertical, 
  Plus, 
  Mail, 
  Phone, 
  MapPin, 
  Wallet,
  ArrowUpRight,
  UserPlus
} from 'lucide-react';
import { motion } from 'motion/react';

interface User {
  id: string;
  nama: string;
  nim: string;
  coin_balance: number;
  avatar_url: string;
}

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    fetch('/api/users')
      .then(res => res.json())
      .then(data => setUsers(data));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Database Pengguna</h2>
          <p className="text-sm text-slate-500 font-medium">Kelola akun siswa dan perolehan koin.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">
          <UserPlus size={16} />
          Tambah Pengguna Baru
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {users.map((user, i) => (
          <motion.div
            key={user.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            className="bg-white p-6 rounded-2xl border border-slate-100 shadow-premium group hover:border-indigo-100 transition-all"
          >
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-4">
                <img 
                  src={user.avatar_url} 
                  alt={user.nama} 
                  className="w-12 h-12 rounded-xl object-cover border border-slate-100"
                  referrerPolicy="no-referrer"
                />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{user.nama}</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{user.nim}</p>
                </div>
              </div>
              <button className="p-1.5 text-slate-300 hover:text-slate-600 transition-colors">
                <MoreVertical size={16} />
              </button>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-white border border-slate-100 text-indigo-600">
                  <Wallet size={16} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Koin</p>
                  <p className="text-sm font-bold text-slate-900">{user.coin_balance.toLocaleString()}</p>
                </div>
              </div>
              <button className="p-1.5 bg-white border border-slate-100 rounded-lg text-slate-400 hover:text-indigo-600 hover:border-indigo-100 transition-all">
                <Plus size={14} />
              </button>
            </div>

            <div className="mt-6 pt-6 border-t border-slate-50 flex items-center justify-between">
              <div className="flex -space-x-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="w-6 h-6 rounded-full border-2 border-white bg-slate-100" />
                ))}
              </div>
              <button className="text-[10px] font-bold text-indigo-600 hover:underline flex items-center gap-1">
                Lihat Aktivitas <ArrowUpRight size={10} />
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
