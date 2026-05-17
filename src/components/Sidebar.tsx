import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  ShoppingBag, 
  Users, 
  Wallet, 
  History, 
  Settings, 
  ChevronLeft,
  ChevronRight,
  LogOut,
  CreditCard,
  ChefHat,
  Monitor,
  Package,
  Coins
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { motion } from 'motion/react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export type UserRole = 'Admin' | 'Kasir' | 'Koki';

const navItems = [
  { id: 'dashboard', label: 'Ringkasan', icon: LayoutDashboard, section: 'Utama', roles: ['Admin'] },
  { id: 'orders', label: 'Verifikasi & Transaksi', icon: ShoppingBag, section: 'Utama', roles: ['Admin', 'Kasir'] },
  { id: 'reports', label: 'Laporan Penjualan', icon: History, section: 'Utama', roles: ['Admin'] },
  { id: 'stock', label: 'Stok & Gesture', icon: Package, section: 'Utama', roles: ['Admin', 'Koki'] },
  { id: 'kds', label: 'Tampilan Dapur', icon: ChefHat, section: 'Utama', roles: ['Admin', 'Koki', 'Kasir'] },
  { id: 'promotions', label: 'Papan Digital', icon: Monitor, section: 'Pemasaran', roles: ['Admin'] },
  { id: 'coin-promos', label: 'Promo Koin', icon: Coins, section: 'Pemasaran', roles: ['Admin'] },
  { id: 'users', label: 'Database Pengguna', icon: Users, section: 'Manajemen', roles: ['Admin'] },
  { id: 'staff', label: 'Tim & Shift', icon: Users, section: 'Manajemen', roles: ['Admin'] },
  { id: 'logs', label: 'Log Audit', icon: History, section: 'Sistem', roles: ['Admin'] },
  { id: 'settings', label: 'Pengaturan Admin', icon: Settings, section: 'Sistem', roles: ['Admin'] },
];

export default function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [currentRole, setCurrentRole] = useState<UserRole>('Admin');

  const filteredNavItems = navItems.filter(item => item.roles.includes(currentRole));
  const sections = Array.from(new Set(filteredNavItems.map(item => item.section)));

  return (
    <motion.aside
      initial={false}
      animate={{ width: isCollapsed ? '80px' : '260px' }}
      className="h-screen bg-white border-r border-slate-100 flex flex-col relative z-20 shadow-sm"
    >
      {/* Logo Section */}
      <div className="p-6 flex items-center gap-3 overflow-hidden border-b border-slate-50">
        <div className="w-10 h-10 rounded-full bg-white border-2 border-orange-400 flex flex-col items-center justify-center shrink-0 shadow-sm relative">
          <div className="flex flex-col items-center leading-none">
            <span className="text-[10px] font-black text-slate-900 tracking-tighter -mb-0.5">ngo</span>
            <span className="text-[10px] font-black text-slate-900 tracking-tighter">lab</span>
          </div>
          <div className="absolute -right-1 top-2 w-3 h-3 rounded-full bg-orange-400 flex items-center justify-center border border-white">
            <span className="text-[6px] text-white font-bold">X</span>
          </div>
        </div>
        {!isCollapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="font-bold text-sm tracking-tight whitespace-nowrap text-slate-900 flex flex-col"
          >
            <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">ngolab</span>
            <span className="leading-none mt-0.5">Geasture-East <span className="text-indigo-600">Admin</span></span>
          </motion.div>
        )}
      </div>

      {/* Role Switcher (Simulator) */}
      {!isCollapsed && (
        <div className="px-6 py-4 border-b border-slate-50">
          <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest block mb-2">Simulasi Peran</label>
          <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100">
            {(['Admin', 'Kasir', 'Koki'] as UserRole[]).map(r => (
              <button
                key={r}
                onClick={() => {
                  setCurrentRole(r);
                  const available = navItems.filter(n => n.roles.includes(r));
                  if (!available.find(a => a.id === activeTab)) {
                    setActiveTab(available[0].id);
                  }
                }}
                className={cn(
                  "flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-tight transition-all",
                  currentRole === r ? "bg-white text-indigo-600 shadow-sm border border-slate-100" : "text-slate-400 hover:text-slate-600"
                )}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-6 space-y-8 custom-scrollbar">
        {sections.map(section => (
          <div key={section} className="space-y-2">
            {!isCollapsed && (
              <h3 className="px-6 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
                {section}
              </h3>
            )}
            <div className="px-3 space-y-1">
              {filteredNavItems
                .filter(item => item.section === section)
                .map(item => (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative text-sm",
                      activeTab === item.id 
                        ? "bg-indigo-50 text-indigo-600 font-semibold" 
                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                    )}
                  >
                    <item.icon className={cn("w-4.5 h-4.5 shrink-0", activeTab === item.id ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600")} />
                    {!isCollapsed && (
                      <span className="whitespace-nowrap">{item.label}</span>
                    )}
                    {activeTab === item.id && (
                      <motion.div
                        layoutId="active-pill"
                        className="absolute right-0 w-1 h-5 bg-indigo-600 rounded-l-full"
                      />
                    )}
                  </button>
                ))}
            </div>
          </div>
        ))}
      </div>

      {/* Footer / Profile */}
      <div className="p-4 border-t border-slate-100">
        <div className={cn("flex items-center gap-3 p-2 rounded-xl bg-slate-50/50", isCollapsed ? "justify-center" : "")}>
          <div className="relative shrink-0">
            <div className="w-9 h-9 rounded-full bg-white border border-slate-200 overflow-hidden flex items-center justify-center font-bold text-xs text-indigo-600 uppercase">
              {currentRole.substring(0, 2)}
            </div>
            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white" />
          </div>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-900 truncate">Petugas {currentRole}</p>
              <p className="text-[10px] text-slate-500 font-medium">{currentRole === 'Admin' ? 'Superuser' : 'User Akses Terbatas'}</p>
            </div>
          )}
        </div>
      </div>

      {/* Collapse Toggle */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-20 w-6 h-6 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-colors z-30 shadow-sm"
      >
        {isCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </motion.aside>
  );
}
