import React, { useState, useEffect, useRef } from 'react';
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
import MenuAvailability from './MenuAvailability';
import SalesReport from './SalesReport';
import MenuManagement from './MenuManagement';
import SalesHistory from './SalesHistory';
import IoTConfig from './IoTConfig';
import PreorderManagement from './PreorderManagement';
import PreorderOrders from './PreorderOrders';
import ApiDocumentation from './ApiDocumentation';
import { cn } from '@/src/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, Search, Settings, User, HelpCircle, Volume2, VolumeX } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import socket from '../lib/socket';
import { playBellWithResume, playConfiguredKdsSound, unlockAudioContext } from '../lib/audioHelper';
import { createOrderBellDeduper, getOrderBellType, subscribeToOrderEvents } from '../lib/orderEvents';

export default function Layout() {
  const { user, activeRole } = useAuth();
  const { settings } = useSettings();
  const bellDeduper = useRef(createOrderBellDeduper());
  // Ref agar handler socket selalu baca nilai soundEnabled terbaru (no stale closure)
  const soundEnabledRef = useRef(localStorage.getItem('tangolab_sound_enabled') !== 'false');
  
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
    soundEnabledRef.current = soundEnabled; // always up-to-date in socket handlers
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

  // ─── GLOBAL KITCHEN BELL ───────────────────────────────────────────────────
  // Subscribe ke socket events SEKALI di level Layout agar suara berbunyi
  // untuk SEMUA jenis pesanan (manual, online, preorder) tanpa perlu
  // setiap komponen mendaftarkan listener sendiri-sendiri.
  // soundEnabledRef & settingsRef memastikan handler selalu baca nilai terbaru
  // tanpa harus unsubscribe/re-subscribe setiap state berubah.
  const settingsRef = useRef(settings);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  useEffect(() => {
    const ringBell = async (type: 'new_order' | 'ready', orderId: string | number) => {
      if (!soundEnabledRef.current) return;
      if (!bellDeduper.current.shouldRing(type, orderId)) return;
      console.log(`🔔 [Layout] Bell "${type}" untuk order #${orderId}`);
      try {
        await playConfiguredKdsSound(type, settingsRef.current as Record<string, unknown>);
      } catch (e) {
        console.warn('[Layout] Bell gagal diputar:', e);
      }
    };

    const onPreorderDue = (campaign: any) => {
      const releaseId = `preorder:${campaign?.id ?? 'unknown'}`;
      if (campaign?.id != null) ringBell('new_order', releaseId);
    };

    const unsubscribe = subscribeToOrderEvents(socket, {
      onNewOrder: (payload: any) => {
        const bellType = getOrderBellType('new_order', payload);
        if (bellType && payload?.id != null) ringBell(bellType, payload.id);
      },
      onOrderUpdated: (payload: any) => {
        const bellType = getOrderBellType('order_updated', payload);
        if (bellType && payload?.id != null) ringBell(bellType, payload.id);
      },
    });
    socket.on('preorder_due', onPreorderDue);

    // Pastikan socket terhubung
    if (!socket.connected) socket.connect();

    return () => {
      unsubscribe();
      socket.off('preorder_due', onPreorderDue);
    };
  // Mount once — soundEnabledRef & settingsRef selalu up-to-date via effect above
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    'stock': 'Inventori Ngolab',
    'staff': 'Tim & Manajemen Shift',
    'logs': 'Pusat Log & Audit Sistem',
    'product-promos': 'Manajemen Promo Produk',
    'vouchers': 'Manajemen Voucher Koin',
    'menu-availability': 'Ketersediaan Menu',
    'menu-management': 'Manajemen Menu',
    'preorders': 'Menu Pre-order',
    'preorder-orders': 'Pesanan Pre-order',
    'sales-history': 'Riwayat Transaksi',
    'settings': 'Hardware & IoT Configuration',
    'api-docs': 'Dokumentasi & API'
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
      case 'menu-availability': return <MenuAvailability onNavigate={setActiveTab} />;
      case 'menu-management': return <MenuManagement onNavigate={setActiveTab} />;
      case 'preorders': return <PreorderManagement />;
      case 'preorder-orders': return <PreorderOrders />;
      case 'sales-history': return <SalesHistory />;
      case 'settings': return <IoTConfig />;
      case 'api-docs': return <ApiDocumentation />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-16 border-b border-slate-100 bg-white/80 dark:bg-[#0f172a]/80 backdrop-blur-md flex items-center justify-between px-8 shrink-0 z-10">
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
                className="w-64 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 rounded-lg pl-10 pr-4 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
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
                    ? "text-slate-400 hover:text-indigo-600 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    : "text-rose-500 hover:text-rose-600 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100/80 dark:hover:bg-rose-500/20"
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
              <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-xs">
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
