import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  User, 
  ChefHat, 
  CheckCircle2, 
  Timer, 
  AlertCircle,
  ChevronRight,
  Play,
  Check,
  MoreVertical,
  BellRing
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/src/lib/utils';
import socket from '../lib/socket';

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
}

export default function KDS() {
  const [orders, setOrders] = useState<KDSOrder[]>([]);
  const [lastOrderVoice, setLastOrderVoice] = useState(false);

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/orders/kds');
      const data = await res.json();
      
      // Convert API order structure to KDS structure
      const kdsOrders: KDSOrder[] = data.map((o: any) => ({
        id: o.id,
        invoice: o.invoice_number,
        customer: o.customer_name || (o.user_id === '1' ? 'Ahmad Fauzi' : o.user_id === '2' ? 'Siti Aminah' : 'Budi Santoso'),
        time: new Date(o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: o.status === 'siap' ? 'ready' : o.status === 'sedang_diproses' ? 'cooking' : 'queue',
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

  useEffect(() => {
    fetchOrders();

    socket.on("new_order", (newOrder: any) => {
      // If payment is already lunas (unlikely for new orders but for simulation), show it
      if (newOrder.payment_status === 'lunas') {
        fetchOrders();
      }
    });

    socket.on("order_updated", (updatedOrder: any) => {
      // If an order was pending and now is lunas, it should appear in KDS
      if (updatedOrder.payment_status === 'lunas') {
        fetchOrders();
      }
    });

    return () => {
      socket.off("new_order");
      socket.off("order_updated");
    };
  }, []);

  const moveOrder = async (orderId: string, nextKdsStatus: 'queue' | 'cooking' | 'ready') => {
    // Map KDS status to API status
    const apiStatus = nextKdsStatus === 'ready' ? 'siap' : nextKdsStatus === 'cooking' ? 'sedang_diproses' : 'antrean';
    
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: apiStatus })
      });
      
      if (res.ok) {
        setOrders(prev => prev.map(order => 
          order.id === orderId ? { ...order, status: nextKdsStatus } : order
        ));
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

  const Column = ({ title, status, icon: Icon, color }: { title: string, status: string, icon: any, color: string }) => (
    <div className="flex flex-col h-full min-w-[350px] max-w-[400px] flex-1">
      <div className="flex items-center justify-between mb-6 px-2">
        <div className="flex items-center gap-3">
          <div className={cn("p-2.5 rounded-xl shadow-sm", `bg-${color}-50 text-${color}-600`)}>
            <Icon size={20} />
          </div>
          <h3 className="font-bold text-slate-900 tracking-tight">{title}</h3>
        </div>
        <span className="bg-white border border-slate-100 px-2.5 py-1 rounded-lg text-xs font-bold text-slate-400 shadow-sm">
          {orders.filter(o => o.status === status).length}
        </span>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto custom-scrollbar pr-2">
        <AnimatePresence mode="popLayout">
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
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-indigo-600 font-mono">{order.invoice}</span>
                    <span className="w-1 h-1 bg-slate-300 rounded-full" />
                    <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      <Clock size={10} />
                      {order.time}
                    </div>
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
                  <div className="flex items-center justify-center gap-2 py-2 text-emerald-600 font-bold text-xs">
                    <CheckCircle2 size={16} />
                    Siap Diambil
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Sistem Tampilan Dapur</h2>
          <p className="text-sm text-slate-500 font-medium">Pantau pesanan dapur dan persiapan secara real-time.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-100 rounded-xl text-xs font-bold text-slate-600 shadow-sm">
            <Timer size={14} className="text-indigo-600" />
            Rata-rata Persiapan: 12m
          </div>
          <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 shadow-sm">
            <ChefHat size={20} />
          </div>
        </div>
      </div>

      <div className="flex-1 flex gap-8 overflow-x-auto pb-4 custom-scrollbar">
        <AnimatePresence>
          {lastOrderVoice && (
            <motion.div 
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed top-24 left-1/2 -translate-x-1/2 z-50 bg-indigo-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border-2 border-white/20 backdrop-blur-md"
            >
              <BellRing className="animate-bounce" />
              <div className="text-left">
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">Notifikasi Dapur</p>
                <p className="text-sm font-black">PESANAN BARU MASUK!</p>
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
