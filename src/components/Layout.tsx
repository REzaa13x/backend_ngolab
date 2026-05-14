import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Dashboard from './Dashboard';
import OrderManagement from './OrderManagement';
import UserManagement from './UserManagement';
import KDS from './KDS';
import PromotionManagement from './PromotionManagement';
import StockManagement from './StockManagement';
import StaffManagement from './StaffManagement';
import AuditLogs from './AuditLogs';
import SalesReport from './SalesReport';
import { cn } from '@/src/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, Search, Settings, User, HelpCircle } from 'lucide-react';

export default function Layout() {
  const [activeTab, setActiveTab] = useState('dashboard');

  const tabTitles: Record<string, string> = {
    'dashboard': 'Ringkasan Dasbor',
    'orders': 'Verifikasi & Transaksi',
    'reports': 'Laporan Penjualan',
    'users': 'Database Pengguna',
    'kds': 'Sistem Tampilan Dapur',
    'promotions': 'Manajer Papan Digital',
    'stock': 'Manajemen Stok & Gesture',
    'staff': 'Tim & Manajemen Shift',
    'logs': 'Pusat Log & Audit Sistem'
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard />;
      case 'orders': return <OrderManagement />;
      case 'reports': return <SalesReport />;
      case 'stock': return <StockManagement />;
      case 'staff': return <StaffManagement />;
      case 'users': return <UserManagement />;
      case 'kds': return <KDS />;
      case 'promotions': return <PromotionManagement />;
      case 'logs': return <AuditLogs />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-16 border-b border-slate-100 bg-white/80 backdrop-blur-md flex items-center justify-between px-8 shrink-0 z-10">
          <div className="flex items-center gap-4 flex-1">
            <h1 className="text-base font-bold text-slate-900">
              {tabTitles[activeTab] || activeTab}
            </h1>
          </div>

          <div className="flex items-center gap-6">
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Cari data..."
                className="w-64 bg-slate-50 border border-slate-100 rounded-lg pl-10 pr-4 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <button className="p-2 text-slate-400 hover:text-indigo-600 transition-colors">
                <HelpCircle className="w-5 h-5" />
              </button>
              <button className="relative p-2 text-slate-400 hover:text-indigo-600 transition-colors">
                <Bell className="w-5 h-5" />
                <span className="absolute top-2 right-2 w-2 h-2 bg-indigo-600 rounded-full border-2 border-white" />
              </button>
            </div>
            
            <div className="h-6 w-[1px] bg-slate-100 mx-1" />
            
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-slate-900">Admin</p>
                <p className="text-[10px] text-slate-500 font-medium">ngolab Geasture-East</p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs">
                A
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="max-w-7xl mx-auto w-full"
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
