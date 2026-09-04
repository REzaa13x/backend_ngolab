import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  Clock, 
  User, 
  ChefHat, 
  CheckCircle2, 
  Timer, 
  AlertCircle,
  Play,
  Check,
  MoreVertical,
  BellRing,
  Volume2,
  VolumeX
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/src/lib/utils';
import socket from '../lib/socket';
import { getOrderBellType, subscribeToOrderEvents } from '../lib/orderEvents';

interface KDSItem {
  id: string;
  name: string;
  quantity: number;
  image: string;
  completed: boolean;
}

interface KDSOrder {
  id: string;
  invoice: string;
  customer: string;
  time: string;
  items: KDSItem[];
  notes?: string;
  status: 'queue' | 'cooking' | 'ready';
  outlet?: 'ngolab' | 'coworking';
  orderType?: string;
  paymentTiming?: string;
  paymentStatus?: string;
}

export default function KDS() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<KDSOrder[]>([]);
  const [selectedOutlet, setSelectedOutlet] = useState<'ngolab' | 'coworking'>('ngolab');
  const [lastOrderVoice, setLastOrderVoice] = useState(false);
  const [bellType, setBellType] = useState<'new_order' | 'ready' | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const saved = localStorage.getItem('tangolab_sound_enabled');
    return saved !== 'false';
  });

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

  const triggerBell = useCallback((type: 'new_order' | 'ready') => {
    setBellType(type);
    setLastOrderVoice(true);
    setTimeout(() => {
      setLastOrderVoice(false);
      setBellType(null);
    }, 4000);
  }, []);

  const fetchOrders = async () => {
    try {
      const res = await fetch(`/api/orders/kds?outlet=${selectedOutlet}`);
      const data = await res.json();
      
      if (!Array.isArray(data)) {
        console.error("API did not return an array:", data);
        setOrders([]);
        return;
      }
      
      // Convert API order structure to KDS structure
      const kdsOrders: KDSOrder[] = data.map((o: any) => ({
        id: o.id,
        invoice: o.invoice_number,
        customer: o.customer_name || (o.user_id === '1' ? 'Ahmad Fauzi' : o.user_id === '2' ? 'Siti Aminah' : 'Budi Santoso'),
        time: new Date(o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: String(o.status).toLowerCase() === 'siap' ? 'ready' : String(o.status).toLowerCase() === 'sedang_diproses' ? 'cooking' : 'queue',
        outlet: o.outlet,
        orderType: o.order_type,
        paymentTiming: o.payment_timing,
        paymentStatus: o.payment_status,
        items: o.items ? o.items.map((item: any, idx: number) => ({
          id: `i-${o.id}-${idx}`,
          name: item.name,
          quantity: item.quantity,
          image: `https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100&q=80`,
          completed: false
        })) : [
          { id: `i-${o.id}`, name: 'Pesanan Paket', quantity: 1, image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100&q=80', completed: false }
        ]
      }));
      setOrders(kdsOrders);
    } catch (err) {
      console.error("KDS Fetch failed:", err);
    }
  };

  const rungKdsNewOrders = useRef(new Set<string>());
  const rungKdsReadyOrders = useRef(new Set<string>());

  useEffect(() => {
    fetchOrders();

    const handleNewOrder = (newOrder: any) => {
      if (newOrder.outlet && newOrder.outlet !== selectedOutlet) return;
      // Pesanan baru langsung lunas → tampilkan di KDS + bell kencang
      if (getOrderBellType('new_order', newOrder) === 'new_order') {
        fetchOrders();
        if (!rungKdsNewOrders.current.has(newOrder.id)) {
          rungKdsNewOrders.current.add(newOrder.id);
          triggerBell('new_order');
        }
      }
    };

    const handleOrderUpdated = (updatedOrder: any) => {
      if (updatedOrder.outlet && updatedOrder.outlet !== selectedOutlet) return;
      const bellType = getOrderBellType('order_updated', updatedOrder);
      if (bellType === 'new_order') {
        // Kasir baru saja memverifikasi → pesanan masuk ke KDS → bell kencang
        fetchOrders();
        if (!rungKdsNewOrders.current.has(updatedOrder.id)) {
          rungKdsNewOrders.current.add(updatedOrder.id);
          triggerBell('new_order');
        }
      } else if (bellType === 'ready') {
        // Koki selesai masak → pesanan siap diambil → chime melodik
        fetchOrders();
        if (!rungKdsReadyOrders.current.has(updatedOrder.id)) {
          rungKdsReadyOrders.current.add(updatedOrder.id);
          triggerBell('ready');
        }
      } else {
        // Update lainnya (dibatalkan, dll) → refresh saja
        fetchOrders();
      }
    };

    const handlePreorderDue = (campaign: any) => {
      if (campaign.outlet !== selectedOutlet) return;
      fetchOrders();
      const releaseId = `po-${campaign.id}`;
      if (!rungKdsNewOrders.current.has(releaseId)) {
        rungKdsNewOrders.current.add(releaseId);
        triggerBell('new_order');
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
  }, [triggerBell, selectedOutlet]);

  const moveOrder = async (orderId: string, nextKdsStatus: 'queue' | 'cooking' | 'ready' | 'completed') => {
    // Map KDS status to API status
    const apiStatus = 
      nextKdsStatus === 'completed' ? 'selesai' :
      nextKdsStatus === 'ready' ? 'siap' : 
      nextKdsStatus === 'cooking' ? 'sedang_diproses' : 'menunggu';
    
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-name': user?.name || 'Koki'
        },
        body: JSON.stringify({ status: apiStatus })
      });
      
      if (res.ok) {
        if (nextKdsStatus === 'completed') {
          setOrders(prev => prev.filter(order => order.id !== orderId));
        } else {
          setOrders(prev => prev.map(order => 
            order.id === orderId ? { ...order, status: nextKdsStatus } : order
          ));
          // Bell chime saat koki sendiri menyelesaikan masak
          if (nextKdsStatus === 'ready') {
            triggerBell('ready');
          }
        }
      }
    } catch (err) {
      console.error("Status update failed:", err);
    }
  };

  const toggleItem = (orderId: string, itemId: string) => {
    setOrders(prev => prev.map(order => {
      if (order.id === orderId) {
        return {
          ...order,
          items: order.items.map(item => 
            item.id === itemId ? { ...item, completed: !item.completed } : item
          )
        };
      }
      return order;
    }));
  };

  const Column = ({ title, status, icon: Icon, color }: { title: string, status: string, icon: any, color: string }) => {
    const count = orders.filter(o => o.status === status).length;
    return (
    <div className="flex flex-col h-full min-w-[350px] max-w-[400px] flex-1">
      <div className="flex items-center justify-between mb-6 px-2">
        <div className="flex items-center gap-3">
          <div className={cn("p-2.5 rounded-xl shadow-sm", `bg-${color}-50 text-${color}-600`)}>
            <Icon size={20} />
          </div>
          <h3 className="font-bold text-slate-900 tracking-tight">{title}</h3>
        </div>
        <span className={cn(
          "px-2.5 py-1 rounded-lg text-xs font-bold shadow-sm border transition-all",
          count > 0 && status === 'queue'
            ? "bg-indigo-600 text-white border-indigo-700 animate-pulse"
            : "bg-white text-slate-400 border-slate-100"
        )}>
          {count}
        </span>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto custom-scrollbar pr-2">
        <AnimatePresence mode="popLayout">
          {count === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-16 gap-3 opacity-40"
            >
              <Icon size={40} strokeWidth={1} className="text-slate-300" />
              <p className="text-xs font-bold text-slate-400 text-center">
                {status === 'queue' ? 'Belum ada pesanan masuk' : status === 'cooking' ? 'Tidak ada yang sedang dimasak' : 'Tidak ada yang siap diambil'}
              </p>
            </motion.div>
          )}
          {orders.filter(o => o.status === status).map((order) => (
            <motion.div
              key={order.id}
              layout
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, x: 50 }}
              className="bg-white rounded-2xl border border-slate-100 shadow-premium overflow-hidden group hover:border-indigo-100 transition-all"
            >
              {/* Card Header */}
              <div className="p-5 border-b border-slate-50 flex items-start justify-between bg-white">
                <div>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-xs font-bold text-indigo-600 font-mono">{order.invoice}</span>
                    <span className="w-1 h-1 bg-slate-300 rounded-full" />
                    <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      <Clock size={10} />
                      {order.time}
                    </div>
                    <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[9px] font-bold uppercase text-slate-600">{order.outlet || selectedOutlet}</span>
                    {order.orderType === 'preorder' && <span className="px-1.5 py-0.5 rounded bg-violet-50 text-[9px] font-bold text-violet-700">PO</span>}
                    {order.paymentTiming === 'before_pickup' && order.paymentStatus !== 'lunas' && <span className="px-1.5 py-0.5 rounded bg-rose-50 text-[9px] font-bold text-rose-700">Belum lunas</span>}
                    {order.paymentTiming === 'on_pickup' && order.paymentStatus !== 'lunas' && <span className="px-1.5 py-0.5 rounded bg-amber-50 text-[9px] font-bold text-amber-700">Bayar saat pengambilan</span>}
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <User size={14} className="text-slate-400" />
                    {order.customer}
                  </h4>
                </div>
                <button className="p-1.5 text-slate-300 hover:text-slate-600 transition-colors">
                  <MoreVertical size={16} />
                </button>
              </div>

              {/* Items List */}
              <div className="p-5 space-y-4">
                {order.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-4 group/item">
                    <div className="relative shrink-0">
                      <img 
                        src={item.image} 
                        alt={item.name} 
                        className={cn(
                          "w-14 h-14 rounded-xl object-cover border border-slate-100 transition-all",
                          item.completed ? "grayscale opacity-40" : "opacity-100"
                        )}
                        referrerPolicy="no-referrer"
                      />
                      {item.completed && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/20 backdrop-blur-[1px] rounded-xl">
                          <CheckCircle2 size={20} className="text-emerald-500 fill-white" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <p className={cn(
                          "text-base font-bold truncate tracking-tight",
                          item.completed ? "text-slate-400 line-through" : "text-slate-900"
                        )}>
                          {item.quantity}x {item.name}
                        </p>
                        <button 
                          onClick={() => toggleItem(order.id, item.id)}
                          className={cn(
                            "w-6 h-6 rounded-lg border flex items-center justify-center transition-all",
                            item.completed 
                              ? "bg-emerald-50 border-emerald-200 text-emerald-600" 
                              : "bg-white border-slate-200 text-transparent hover:border-indigo-300"
                          )}
                        >
                          <Check size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Notes */}
                {order.notes && (
                  <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-3 flex gap-3">
                    <AlertCircle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-xs font-medium text-amber-800 leading-relaxed">
                      {order.notes}
                    </p>
                  </div>
                )}
              </div>

              {/* Action Footer */}
              <div className="p-4 bg-slate-50/50 border-t border-slate-50">
                {order.status === 'queue' && (
                  <button 
                    onClick={() => moveOrder(order.id, 'cooking')}
                    className="w-full py-3 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
                  >
                    <Play size={14} fill="currentColor" />
                    Mulai Masak
                  </button>
                )}
                {order.status === 'cooking' && (
                  <button 
                    onClick={() => moveOrder(order.id, 'ready')}
                    className="w-full py-3 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 size={14} />
                    Selesaikan Pesanan
                  </button>
                )}
                {order.status === 'ready' && (
                  <button 
                    onClick={() => moveOrder(order.id, 'completed')}
                    className="w-full py-3 bg-emerald-100 hover:bg-emerald-200 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 size={14} />
                    Selesaikan (Sudah Diambil)
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
    );
  };
  return (
    <div className="h-full flex flex-col space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Sistem Tampilan Dapur</h2>
          <p className="text-sm text-slate-500 font-medium">Pantau pesanan dapur dan persiapan secara real-time.</p>
          <div className="mt-4 inline-flex items-center gap-1 p-1 bg-slate-100 border border-slate-200 rounded-xl">
            {(['ngolab', 'coworking'] as const).map(outlet => (
              <button
                key={outlet}
                type="button"
                onClick={() => { setOrders([]); setSelectedOutlet(outlet); }}
                className={cn(
                  'px-4 py-2 rounded-lg text-xs font-bold transition-all',
                  selectedOutlet === outlet
                    ? 'bg-white text-primary shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                )}
              >
                KDS {outlet === 'ngolab' ? 'Ngolab' : 'Coworking'}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-100 rounded-xl text-xs font-bold text-slate-600 shadow-sm">
            <Timer size={14} className="text-indigo-600" />
            Rata-rata Persiapan: 12m
          </div>
          {/* Tombol Mute Bell */}
          <button
            onClick={() => setSoundEnabled(v => !v)}
            title={soundEnabled ? 'Matikan suara bell' : 'Aktifkan suara bell'}
            className={cn(
              "w-10 h-10 rounded-xl border flex items-center justify-center transition-all shadow-sm",
              soundEnabled
                ? "bg-white border-slate-100 text-slate-400 hover:text-indigo-600 hover:border-indigo-200"
                : "bg-rose-50 border-rose-200 text-rose-500"
            )}
          >
            {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
          <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 shadow-sm">
            <ChefHat size={20} />
          </div>
        </div>
      </div>

      <div className="flex-1 flex gap-8 overflow-x-auto pb-4 custom-scrollbar">
        <AnimatePresence>
          {lastOrderVoice && bellType === 'new_order' && (
            <motion.div 
              key="bell-new"
              initial={{ opacity: 0, y: -60, scale: 0.8, rotateX: 20 }}
              animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: -40, rotateX: -20 }}
              transition={{ type: "spring", damping: 15, stiffness: 300 }}
              className="fixed top-12 left-1/2 -translate-x-1/2 z-[100] min-w-[400px]"
            >
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 p-1 shadow-[0_20px_50px_rgba(79,70,229,0.5)] border border-indigo-400/30">
                {/* Glow effect */}
                <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/20 via-transparent to-transparent opacity-60"></div>
                
                <div className="relative bg-indigo-900/40 backdrop-blur-xl rounded-[22px] px-6 py-5 flex items-center gap-5">
                  <div className="relative shrink-0 w-14 h-14 rounded-2xl bg-indigo-500/30 border border-indigo-400/50 flex items-center justify-center shadow-inner">
                    <BellRing size={32} className="text-white animate-bounce drop-shadow-md" />
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-rose-500 border-2 border-indigo-800 rounded-full animate-ping" />
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-rose-500 border-2 border-indigo-800 rounded-full" />
                  </div>
                  
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 rounded-md bg-white/20 text-white text-[10px] font-bold uppercase tracking-widest backdrop-blur-md">
                        Pesanan Baru
                      </span>
                      <span className="text-indigo-200 text-xs font-medium flex items-center gap-1">
                        <Clock size={12} /> {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xl font-black text-white tracking-tight drop-shadow-sm">
                      PESANAN MASUK!
                    </p>
                    <p className="text-indigo-200 text-sm font-medium mt-0.5">
                      Segera siapkan pesanan di antrean dapur.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
          {lastOrderVoice && bellType === 'ready' && (
            <motion.div 
              key="bell-ready"
              initial={{ opacity: 0, y: -60, scale: 0.8, rotateX: 20 }}
              animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: -40, rotateX: -20 }}
              transition={{ type: "spring", damping: 15, stiffness: 300 }}
              className="fixed top-12 left-1/2 -translate-x-1/2 z-[100] min-w-[400px]"
            >
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 p-1 shadow-[0_20px_50px_rgba(16,185,129,0.5)] border border-emerald-400/30">
                {/* Glow effect */}
                <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/20 via-transparent to-transparent opacity-60"></div>
                
                <div className="relative bg-emerald-900/40 backdrop-blur-xl rounded-[22px] px-6 py-5 flex items-center gap-5">
                  <div className="relative shrink-0 w-14 h-14 rounded-2xl bg-emerald-500/30 border border-emerald-400/50 flex items-center justify-center shadow-inner">
                    <CheckCircle2 size={32} className="text-white animate-bounce drop-shadow-md" />
                  </div>
                  
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 rounded-md bg-white/20 text-white text-[10px] font-bold uppercase tracking-widest backdrop-blur-md">
                        Siap Diambil
                      </span>
                    </div>
                    <p className="text-xl font-black text-white tracking-tight drop-shadow-sm">
                      PESANAN SELESAI!
                    </p>
                    <p className="text-emerald-100 text-sm font-medium mt-0.5">
                      Pesanan siap diberikan ke pelanggan.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <Column title="Pesanan Masuk" status="queue" icon={Timer} color="indigo" />
        <Column title="Sedang Dimasak" status="cooking" icon={ChefHat} color="amber" />
        <Column title="Siap Diambil" status="ready" icon={CheckCircle2} color="emerald" />
      </div>
    </div>
  );
}
