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
  Coins,
  PhoneCall,
  Coffee,
  UtensilsCrossed,
  TrendingUp,
  Tag,
  Gift
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { motion } from 'motion/react';

import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export type UserRole = 'Super Admin' | 'Kasir' | 'Koki' | 'Support';

const navItems = [
  { id: 'dashboard', label: 'Ringkasan', icon: LayoutDashboard, section: 'Utama', roles: ['Super Admin', 'Kasir', 'Koki'] },
  { id: 'orders', label: 'Verifikasi & Transaksi', icon: ShoppingBag, section: 'Utama', roles: ['Super Admin', 'Kasir'] },
  { id: 'manual-order', label: 'Pesanan Manual', icon: PhoneCall, section: 'Utama', roles: ['Super Admin', 'Kasir'] },
  { id: 'reports', label: 'Analisis & Laporan', icon: History, section: 'Utama', roles: ['Super Admin'] },
  { id: 'sales-history', label: 'Riwayat Transaksi', icon: TrendingUp, section: 'Utama', roles: ['Super Admin', 'Kasir'] },
  { id: 'stock', label: 'Katalog Ngolab', icon: Package, section: 'Utama', roles: ['Super Admin', 'Koki', 'Kasir'] },
  { id: 'coworking-menu', label: 'Katalog Coworking', icon: Coffee, section: 'Utama', roles: ['Super Admin', 'Kasir', 'Koki'] },
  { id: 'kds', label: 'Tampilan Dapur', icon: ChefHat, section: 'Utama', roles: ['Super Admin', 'Koki', 'Kasir'] },
  { id: 'promotions', label: 'Papan Digital', icon: Monitor, section: 'Pemasaran', roles: ['Super Admin'] },
  { id: 'product-promos', label: 'Promo Produk', icon: Tag, section: 'Pemasaran', roles: ['Super Admin', 'Kasir'] },
  { id: 'vouchers', label: 'Voucher Koin', icon: Gift, section: 'Pemasaran', roles: ['Super Admin', 'Kasir'] },
  { id: 'users', label: 'Database Pengguna', icon: Users, section: 'Manajemen', roles: ['Super Admin', 'Kasir'] },
  { id: 'staff', label: 'Tim & Shift', icon: Users, section: 'Manajemen', roles: ['Super Admin'] },
  { id: 'menu-management', label: 'Manajemen Menu', icon: UtensilsCrossed, section: 'Manajemen', roles: ['Super Admin', 'Koki'] },
  { id: 'logs', label: 'Log Audit', icon: History, section: 'Sistem', roles: ['Super Admin', 'Kasir', 'Koki'] },
  { id: 'settings', label: 'Pengaturan Admin', icon: Settings, section: 'Sistem', roles: ['Super Admin', 'Kasir', 'Koki'] },
];

export default function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { user, activeRole, setActiveRole, logout } = useAuth();
  const { settings } = useSettings();
  
  const currentRole = activeRole || user?.role || 'Kasir';

  const filteredNavItems = navItems.filter(item => item.roles.includes(currentRole));
  const sections = Array.from(new Set(filteredNavItems.map(item => item.section)));

  return (
    <motion.aside
      initial={false}
      animate={{ width: isCollapsed ? '80px' : '260px' }}
      className="h-screen bg-[var(--sidebar-bg)] border-r border-[var(--sidebar-border)] flex flex-col relative z-20 shadow-sm"
    >
      {/* Logo Section */}
      <div className="p-6 flex items-center gap-3 overflow-hidden border-b border-[var(--sidebar-border)]">
        {settings.brand_logo_url ? (
          <img 
            src={settings.brand_logo_url} 
            alt={settings.brand_name} 
            className="w-10 h-10 rounded-xl object-cover shrink-0 shadow-sm border border-slate-100"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-white border-2 border-orange-400 flex flex-col items-center justify-center shrink-0 shadow-sm relative">
            <div className="flex flex-col items-center leading-none">
              <span className="text-[10px] font-black text-slate-900 tracking-tighter -mb-0.5">
                {settings.brand_name.substring(0, 3)}
              </span>
              <span className="text-[10px] font-black text-slate-900 tracking-tighter">
                {settings.brand_name.substring(3, 7) || 'lab'}
              </span>
            </div>
            <div className="absolute -right-1 top-2 w-3 h-3 rounded-full bg-orange-400 flex items-center justify-center border border-white">
              <span className="text-[6px] text-white font-bold">X</span>
            </div>
          </div>
        )}
        {!isCollapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="font-bold text-sm tracking-tight whitespace-nowrap text-[var(--sidebar-logo-text)] flex flex-col min-w-0"
          >
            <span className="text-[10px] text-[var(--sidebar-section-text)] uppercase tracking-widest font-extrabold truncate">
              {settings.brand_name}
            </span>
            <span className="leading-none mt-0.5 text-[var(--sidebar-text)] font-bold text-xs truncate">
              {settings.brand_subtitle} <span className="text-[var(--sidebar-active-text)] font-extrabold">Admin</span>
            </span>
          </motion.div>
        )}
      </div>

      {/* Role Switcher for Admin */}
      {!isCollapsed && user?.role === 'Super Admin' && (
        <div className="px-6 py-3 border-b border-slate-50 bg-slate-50/30">
          <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
            Tampilan Peran:
          </label>
          <div className="flex gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200">
            {(['Super Admin', 'Kasir', 'Koki'] as UserRole[]).map(r => (
              <button
                key={r}
                onClick={() => {
                  setActiveRole(r);
                  // Auto navigate to the default page of the new role
                  if (r === 'Super Admin') setActiveTab('dashboard');
                  else if (r === 'Kasir') setActiveTab('orders');
                  else if (r === 'Koki') setActiveTab('kds');
                }}
                className={cn(
                  'flex-1 text-[9px] font-bold py-1.5 px-2 rounded-lg transition-all',
                  currentRole === r
                    ? 'bg-white text-indigo-600 shadow-sm font-black'
                    : 'text-slate-400 hover:text-slate-700'
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
              <h3 className="px-6 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--sidebar-section-text)]">
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
                        ? "bg-[var(--sidebar-active-bg)] text-[var(--sidebar-active-text)] font-semibold" 
                        : "text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--sidebar-hover-text)]"
                    )}
                  >
                    <item.icon className={cn("w-4.5 h-4.5 shrink-0", activeTab === item.id ? "text-[var(--sidebar-active-text)]" : "text-[var(--sidebar-text)] group-hover:text-[var(--sidebar-hover-text)]")} />
                    {!isCollapsed && (
                      <span className="whitespace-nowrap">{item.label}</span>
                    )}
                    {activeTab === item.id && (
                      <motion.div
                        layoutId="active-pill"
                        className="absolute right-0 w-1 h-5 bg-[var(--sidebar-active-text)] rounded-l-full"
                      />
                    )}
                  </button>
                ))}
            </div>
          </div>
        ))}
      </div>

      {/* Footer / Profile */}
      <div className="p-4 border-t border-[var(--sidebar-border)]">
        <div className={cn("flex items-center gap-3 p-2 rounded-xl bg-[var(--sidebar-hover-bg)] mb-2", isCollapsed ? "justify-center" : "")}>
          <div className="relative shrink-0">
            <div className="w-9 h-9 rounded-full bg-[var(--sidebar-bg)] border border-[var(--sidebar-border)] overflow-hidden flex items-center justify-center font-bold text-xs text-[var(--sidebar-active-text)] uppercase">
              {(user?.name || 'User').substring(0, 2)}
            </div>
            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white" />
          </div>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-[var(--sidebar-logo-text)] truncate">{user?.name}</p>
              <p className="text-[10px] text-[var(--sidebar-text)] font-medium">{currentRole}</p>
            </div>
          )}
        </div>
        
        <button 
          onClick={logout}
          className={cn(
            "w-full flex items-center justify-center gap-2 p-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors",
            isCollapsed ? "px-0" : ""
          )}
          title="Keluar"
        >
          <LogOut size={16} />
          {!isCollapsed && <span className="text-xs font-bold">Keluar</span>}
        </button>
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
