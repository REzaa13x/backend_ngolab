import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import Dashboard from './Dashboard';
import OrderManagement from './OrderManagement';
import ManualOrder from './ManualOrder';
import UserManagement from './UserManagement';
import KDS from './KDS';
import PromotionManagement from './PromotionManagement';
import StockManagement from './StockManagement';
import StaffManagement from './StaffManagement';
import AuditLogs from './AuditLogs';
import ProductPromoManagement from './ProductPromoManagement';
import VoucherManagement from './VoucherManagement';
import CoworkingMenu from './CoworkingMenu';
import SalesReport from './SalesReport';
import MenuManagement from './MenuManagement';
import SalesHistory from './SalesHistory';
import IoTConfig from './IoTConfig';
import PreorderManagement from './PreorderManagement';
import PreorderOrders from './PreorderOrders';
import { cn } from '@/src/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, Search, Settings, User, HelpCircle, Volume2, VolumeX } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import socket from '../lib/socket';
import { playBellWithResume, unlockAudioContext } from '../lib/audioHelper';
import { getOrderBellType, subscribeToOrderEvents } from '../lib/orderEvents';

export default function Layout() {
  const { user, activeRole } = useAuth();
  
  // Define default tab based on role
  const getDefaultTab = () => {
    const currentRole = activeRole || user?.role;
    switch(currentRole) {
      case 'Super Admin': return 'dashboard';
      case 'Kasir': return 'orders';
      case 'Koki': return 'kds';
      case 'Support': return 'dashboard';
      default: return 'dashboard';
    }
  };

  const [activeTab, setActiveTab] = useState(getDefaultTab());

  const [soundEnabled, setSoundEnabled] = useState(() => {
    const saved = localStorage.getItem('tangolab_sound_enabled');
    return saved !== 'false';
  });
  const [audioUnlocked, setAudioUnlocked] = useState(false);

  // Sync sound settings across tabs and components
  useEffect(() => {
    const syncSound = () => {
      const val = localStorage.getItem('tangolab_sound_enabled') !== 'false';
      setSoundEnabled(val);
    };
    window.addEventListener('sound_enabled_change', syncSound);
    window.addEventListener('storage', syncSound);
    return () => {
      window.removeEventListener('sound_enabled_change', syncSound);
      window.removeEventListener('storage', syncSound);
    };
  }, []);

  // Sync sound state changes to localStorage and notify other components
  useEffect(() => {
    localStorage.setItem('tangolab_sound_enabled', String(soundEnabled));
    window.dispatchEvent(new Event('sound_enabled_change'));
  }, [soundEnabled]);

  // Auto-unlock AudioContext on first user interaction anywhere on the document
  useEffect(() => {
    const handleFirstInteraction = async () => {
      const success = await unlockAudioContext();
      if (success) {
        setAudioUnlocked(true);
        // Remove listener once unlocked
        document.removeEventListener('click', handleFirstInteraction);
        document.removeEventListener('touchstart', handleFirstInteraction);
        console.log("🔊 [Global Layout] AudioContext successfully unlocked via user interaction.");
      }
    };

    document.addEventListener('click', handleFirstInteraction);
    document.addEventListener('touchstart', handleFirstInteraction);

    return () => {
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('touchstart', handleFirstInteraction);
    };
  }, []);

const rungNewOrders = new Set<string>();
const rungReadyOrders = new Set<string>();

  // Global socket listener for new order bell sounds
  useEffect(() => {
    const handleNewOrder = (newOrder: any) => {
      console.log("🔔 [Global Layout] Socket new_order received:", newOrder);
      const isSoundOn = localStorage.getItem('tangolab_sound_enabled') !== 'false';
      const bellType = getOrderBellType('new_order', newOrder);
      if (isSoundOn && bellType === 'new_order') {
        if (!rungNewOrders.has(newOrder.id)) {
          rungNewOrders.add(newOrder.id);
          console.log("🔔 [Global Layout] Playing sound: new_order");
          playBellWithResume('new_order');
        }
      }
    };

    const handleOrderUpdated = (updatedOrder: any) => {
      console.log("🔄 [Global Layout] Socket order_updated received:", updatedOrder);
      const isSoundOn = localStorage.getItem('tangolab_sound_enabled') !== 'false';
      const bellType = getOrderBellType('order_updated', updatedOrder);
      if (isSoundOn) {
        if (bellType === 'new_order') {
          if (!rungNewOrders.has(updatedOrder.id)) {
            rungNewOrders.add(updatedOrder.id);
            console.log("🔔 [Global Layout] Playing sound: new_order (payment lunas)");
            playBellWithResume('new_order');
          }
        } else if (bellType === 'ready') {
          if (!rungReadyOrders.has(updatedOrder.id)) {
            rungReadyOrders.add(updatedOrder.id);
            console.log("🔔 [Global Layout] Playing sound: ready");
            playBellWithResume('ready');
          }
        }
      }
    };

    const handlePreorderDue = (campaign: any) => {
      const isSoundOn = localStorage.getItem('tangolab_sound_enabled') !== 'false';
      const releaseId = `po-${campaign.id}`;
      if (isSoundOn && !rungNewOrders.has(releaseId)) {
        rungNewOrders.add(releaseId);
        playBellWithResume('new_order');
      }
    };

    const cleanupOrders = subscribeToOrderEvents(socket, {
      onNewOrder: handleNewOrder,
      onOrderUpdated: handleOrderUpdated
    });
    socket.on('preorder_due', handlePreorderDue);
    return () => {
      cleanupOrders();
      socket.off('preorder_due', handlePreorderDue);
    };
  }, []);

  const toggleSound = async () => {
    const newSoundEnabled = !soundEnabled;
    setSoundEnabled(newSoundEnabled);
    if (newSoundEnabled) {
      const success = await unlockAudioContext();
      if (success) {
        setAudioUnlocked(true);
        // Play a quick chime to verify audio works
        playBellWithResume('ready');
      }
    }
  };

  const tabTitles: Record<string, string> = {
    'dashboard': 'Ringkasan Dasbor',
    'orders': 'Verifikasi & Transaksi',
    'manual-order': 'Buat Pesanan Manual',
    'reports': 'Analisis & Laporan',
    'users': 'Database Pengguna',
    'kds': 'Sistem Tampilan Dapur',
    'promotions': 'Manajer Papan Digital',
    'stock': 'Katalog Menu Ngolab',
    'staff': 'Tim & Manajemen Shift',
    'logs': 'Pusat Log & Audit Sistem',
    'product-promos': 'Manajemen Promo Produk',
    'vouchers': 'Manajemen Voucher Koin',
    'coworking-menu': 'Katalog Menu Coworking',
    'menu-management': 'Manajemen Menu',
    'preorders': 'Menu Pre-order',
    'preorder-orders': 'Pesanan Pre-order',
    'sales-history': 'Riwayat Transaksi',
    'settings': 'Hardware & IoT Configuration'
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard />;
      case 'orders': return <OrderManagement />;
      case 'manual-order': return <ManualOrder />;
      case 'reports': return <SalesReport />;
      case 'stock': return <StockManagement />;
      case 'staff': return <StaffManagement />;
      case 'users': return <UserManagement />;
      case 'kds': return <KDS />;
      case 'promotions': return <PromotionManagement />;
      case 'logs': return <AuditLogs />;
      case 'product-promos': return <ProductPromoManagement />;
      case 'vouchers': return <VoucherManagement />;
      case 'coworking-menu': return <CoworkingMenu />;
      case 'menu-management': return <MenuManagement onNavigate={setActiveTab} />;
      case 'preorders': return <PreorderManagement />;
      case 'preorder-orders': return <PreorderOrders />;
      case 'sales-history': return <SalesHistory />;
      case 'settings': return <IoTConfig />;
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
              
              {/* Global Kitchen Bell Toggle Button */}
              <button
                onClick={toggleSound}
                title={soundEnabled ? 'Matikan suara bel' : 'Aktifkan suara bel'}
                className={cn(
                  "p-2 rounded-lg transition-colors flex items-center justify-center relative",
                  soundEnabled
                    ? "text-slate-400 hover:text-indigo-600 hover:bg-slate-50"
                    : "text-rose-500 hover:text-rose-600 bg-rose-50 hover:bg-rose-100/80"
                )}
              >
                {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                {soundEnabled && !audioUnlocked && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-amber-500 rounded-full border border-white animate-pulse" title="Perlu interaksi untuk mengaktifkan audio" />
                )}
              </button>

              <button className="relative p-2 text-slate-400 hover:text-indigo-600 transition-colors">
                <Bell className="w-5 h-5" />
                <span className="absolute top-2 right-2 w-2 h-2 bg-indigo-600 rounded-full border-2 border-white" />
              </button>
            </div>
            
            <div className="h-6 w-[1px] bg-slate-100 mx-1" />
            
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-slate-900">{user?.name || 'Guest'}</p>
                <p className="text-[10px] text-slate-500 font-medium">Tangolab Geasture-East</p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs">
                {(user?.name?.charAt(0) || 'U').toUpperCase()}
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
