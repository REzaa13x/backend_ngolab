import React, { useEffect, useState } from 'react';
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
  UtensilsCrossed,
  TrendingUp,
  Tag,
  Gift,
  CalendarClock,
  CalendarCheck,
  CheckCircle2,
  Webhook
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { motion } from 'motion/react';

import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { authFetch } from '../lib/authFetch';
import socket from '../lib/socket';

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
  { id: 'menu-availability', label: 'Ketersediaan Menu', icon: CheckCircle2, section: 'Utama', roles: ['Super Admin', 'Kasir', 'Koki'] },
  { id: 'stock', label: 'Inventori', icon: Package, section: 'Utama', roles: ['Super Admin', 'Koki', 'Kasir'] },
  { id: 'kds', label: 'Tampilan Dapur', icon: ChefHat, section: 'Utama', roles: ['Super Admin', 'Koki', 'Kasir'] },
  { id: 'promotions', label: 'Papan Digital', icon: Monitor, section: 'Pemasaran', roles: ['Super Admin'] },
  { id: 'product-promos', label: 'Promo Produk', icon: Tag, section: 'Pemasaran', roles: ['Super Admin', 'Kasir'] },
  { id: 'vouchers', label: 'Voucher Koin', icon: Gift, section: 'Pemasaran', roles: ['Super Admin', 'Kasir'] },
  { id: 'users', label: 'Database Pengguna', icon: Users, section: 'Manajemen', roles: ['Super Admin', 'Kasir'] },
  { id: 'staff', label: 'Tim & Shift', icon: Users, section: 'Manajemen', roles: ['Super Admin'] },
  { id: 'menu-management', label: 'Manajemen Menu', icon: UtensilsCrossed, section: 'Manajemen', roles: ['Super Admin', 'Koki'] },
  { id: 'preorders', label: 'Menu Pre-order', icon: CalendarClock, section: 'Manajemen', roles: ['Super Admin', 'Kasir', 'Koki'] },
  { id: 'preorder-orders', label: 'Pesanan Pre-order', icon: CalendarCheck, section: 'Utama', roles: ['Super Admin', 'Kasir', 'Koki'] },
  { id: 'logs', label: 'Log Audit', icon: History, section: 'Sistem', roles: ['Super Admin', 'Kasir', 'Koki'] },
  { id: 'api-docs', label: 'API & Integrasi', icon: Webhook, section: 'Sistem', roles: ['Super Admin'] },
  { id: 'settings', label: 'Pengaturan Admin', icon: Settings, section: 'Sistem', roles: ['Super Admin'] },
];

export default function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { user, activeRole, setActiveRole, logout } = useAuth();
  const { settings } = useSettings();
  const [stockAlertCount, setStockAlertCount] = useState(0);
  const [kdsPendingCount, setKdsPendingCount] = useState(0);

  useEffect(() => {
    const refreshStockAlerts = async () => {
      try {
        const response = await authFetch('/api/ingredients/summary?outlet=ngolab');
        if (!response.ok) return;
        const data = await response.json();
        setStockAlertCount(Number(data.counts?.low || 0) + Number(data.counts?.critical || 0) + Number(data.counts?.out || 0));
      } catch { /* badge akan dicoba kembali saat event berikutnya */ }
    };
    refreshStockAlerts();
    socket.on('inventory_updated', refreshStockAlerts);
    socket.on('low_stock_alert', refreshStockAlerts);
    return () => {
      socket.off('inventory_updated', refreshStockAlerts);
      socket.off('low_stock_alert', refreshStockAlerts);
    };
  }, []);

  useEffect(() => {
    const refreshKdsPending = async () => {
      try {
        const response = await authFetch('/api/orders/kds/pending-count');
        if (!response.ok) return;
        const data = await response.json();
        setKdsPendingCount(Number(data.total || 0));
      } catch { /* sinkronisasi berikutnya akan mencoba kembali */ }
    };
    refreshKdsPending();
    const interval = window.setInterval(refreshKdsPending, 30000);
    socket.on('new_order', refreshKdsPending);
    socket.on('order_updated', refreshKdsPending);
    socket.on('preorder_due', refreshKdsPending);
    return () => {
      window.clearInterval(interval);
      socket.off('new_order', refreshKdsPending);
      socket.off('order_updated', refreshKdsPending);
      socket.off('preorder_due', refreshKdsPending);
    };
  }, []);
  
  const currentRole = activeRole || user?.role || 'Kasir';

  const filteredNavItems = navItems.filter(item => item.roles.includes(currentRole));
  const sections = Array.from(new Set(filteredNavItems.map(item => item.section)));

  return (
    <motion.aside
      initial={false}
      animate={{ width: isCollapsed ? '80px' : '260px' }}
      className="h-screen bg-slate-50 dark:bg-[#0f172a] border-r border-slate-100 dark:border-slate-800 flex flex-col relative z-20 shadow-premium"
    >
      {/* Logo Section */}
      <div className="p-6 flex items-center gap-3 overflow-hidden border-b border-slate-100 dark:border-slate-800">
        {settings.brand_logo_url ? (
          <img 
            src={settings.brand_logo_url} 
            alt={settings.brand_name} 
            className="w-10 h-10 rounded-xl object-cover shrink-0 shadow-sm border border-slate-200 dark:border-slate-700"
          />
        ) : (
          <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center shrink-0 shadow-sm relative">
            <div className="flex flex-col items-center leading-none">
              <span className="text-[10px] font-black text-slate-900 tracking-tighter -mb-0.5">
                {settings.brand_name.substring(0, 3)}
              </span>
              <span className="text-[10px] font-black text-indigo-600 tracking-tighter">
                {settings.brand_name.substring(3, 7) || 'lab'}
              </span>
            </div>
          </div>
        )}
        {!isCollapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="font-bold text-sm tracking-tight whitespace-nowrap text-slate-900 dark:text-white flex flex-col min-w-0"
          >
            <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-widest font-extrabold truncate">
              {settings.brand_name}
            </span>
            <span className="leading-none mt-0.5 text-slate-800 dark:text-slate-200 font-bold text-xs truncate">
              {settings.brand_subtitle} <span className="text-orange-500 font-extrabold">Admin</span>
            </span>
          </motion.div>
        )}
      </div>

      {/* Role Switcher for Admin */}
      {!isCollapsed && user?.role === 'Super Admin' && (
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">
            Tampilan Peran:
          </label>
          <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800/50 rounded-xl border border-slate-200/50 dark:border-slate-700/50 shadow-inner">
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
                  'flex-1 text-[11px] font-bold py-2 px-1 rounded-lg transition-all',
                  currentRole === r
                    ? 'bg-white dark:bg-slate-700 text-orange-500 dark:text-orange-400 shadow-sm border border-slate-200 dark:border-slate-600'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
                )}
              >
                {r === 'Super Admin' ? 'Admin' : r}
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
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative text-sm font-medium",
                      activeTab === item.id 
                        ? "bg-orange-500 text-white font-bold shadow-md" 
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                    )}
                  >
                    <item.icon className={cn(
                      "w-4.5 h-4.5 shrink-0 transition-colors", 
                      activeTab === item.id 
                        ? "text-white" 
                        : "text-slate-500 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-white"
                    )} />
                    {!isCollapsed && (
                      <span className="whitespace-nowrap">{item.label}</span>
                    )}
                    {item.id === 'kds' && kdsPendingCount > 0 && (
                      <span className={cn(
                        'ml-auto min-w-5 h-5 px-1 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center animate-pulse',
                        activeTab === item.id && 'bg-white text-rose-600',
                        isCollapsed && 'absolute -top-1 -right-1'
                      )}>{kdsPendingCount > 99 ? '99+' : kdsPendingCount}</span>
                    )}
                    {item.id === 'stock' && stockAlertCount > 0 && (
                      <span className={cn(
                        'ml-auto min-w-5 h-5 px-1 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center',
                        activeTab === item.id && 'bg-white text-rose-600',
                        isCollapsed && 'absolute -top-1 -right-1'
                      )}>{stockAlertCount > 99 ? '99+' : stockAlertCount}</span>
                    )}
                    {activeTab === item.id && (
                      <motion.div
                        layoutId="active-pill"
                        className="absolute right-0 w-1.5 h-6 bg-white rounded-l-full"
                      />
                    )}
                  </button>
                ))}
            </div>
          </div>
        ))}
      </div>

      {/* Footer / Profile */}
      <div className="p-4 border-t border-slate-100 dark:border-slate-800">
        <div className={cn("flex items-center gap-3 p-2 rounded-xl bg-slate-50 dark:bg-[#0f172a] mb-2 border border-slate-100 dark:border-slate-800", isCollapsed ? "justify-center" : "")}>
          <div className="relative shrink-0">
            <div className="w-9 h-9 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden flex items-center justify-center font-bold text-xs text-orange-500 uppercase shadow-sm">
              {(user?.name || 'User').substring(0, 2)}
            </div>
            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-800" />
          </div>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{user?.name}</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                {currentRole === 'Super Admin' ? 'Admin' : currentRole}
              </p>
            </div>
          )}
        </div>
        
        <button 
          onClick={logout}
          className={cn(
            "w-full flex items-center justify-center gap-2 p-2 rounded-lg text-rose-500 hover:bg-rose-50 hover:text-rose-600 transition-colors",
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
        className="absolute -right-3 top-20 w-6 h-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-orange-500 dark:hover:text-orange-400 transition-colors z-30 shadow-premium"
      >
        {isCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </motion.aside>
  );
}
