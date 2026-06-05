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

// ============================================================
// Web Audio API Bell Synthesizer — dengan AudioContext persisten
// ============================================================

// AudioContext persisten — dibuat sekali, di-resume setiap mau bunyi
// Solusi untuk browser yang men-suspend AudioContext saat stand-by
let persistentAudioCtx: AudioContext | null = null;

function getOrCreateAudioCtx(): AudioContext | null {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!persistentAudioCtx || persistentAudioCtx.state === 'closed') {
      persistentAudioCtx = new AudioCtx();
    }
    return persistentAudioCtx;
  } catch {
    return null;
  }
}

async function playBellWithResume(type: 'new_order' | 'ready') {
  try {
    const ctx = getOrCreateAudioCtx();
    if (!ctx) return;

    // Resume jika browser men-suspend (terjadi saat stand-by / tab tidak aktif)
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    const now = ctx.currentTime;

    if (type === 'new_order') {
      // 🔔🔔🔔 Triple DING kencang metalik — Pesanan Masuk!
      const schedule = [
        { time: 0,    freq: 1318.5,  vol: 1.0 },  // E6
        { time: 0.22, freq: 1318.5,  vol: 0.9 },  // E6
        { time: 0.44, freq: 1567.98, vol: 1.0 },  // G6
      ];
      schedule.forEach(({ time, freq, vol }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const distort = ctx.createWaveShaper();
        const curve = new Float32Array(256);
        for (let i = 0; i < 256; i++) {
          const x = (i * 2) / 256 - 1;
          curve[i] = (Math.PI + 200) * x / (Math.PI + 200 * Math.abs(x));
        }
        distort.curve = curve;
        osc.connect(distort); distort.connect(gain); gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + time);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.5, now + time + 0.6);
        gain.gain.setValueAtTime(0, now + time);
        gain.gain.linearRampToValueAtTime(vol, now + time + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + time + 0.7);
        osc.start(now + time);
        osc.stop(now + time + 0.75);
      });
      // Harmonic overtone metalik
      const oscH = ctx.createOscillator();
      const gainH = ctx.createGain();
      oscH.connect(gainH); gainH.connect(ctx.destination);
      oscH.type = 'sine';
      oscH.frequency.setValueAtTime(2637, now);
      gainH.gain.setValueAtTime(0, now);
      gainH.gain.linearRampToValueAtTime(0.35, now + 0.01);
      gainH.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      oscH.start(now); oscH.stop(now + 0.45);

    } else {
      // 🎵 Chime melodik Do-Mi-Sol — Pesanan Siap Diambil
      const notes = [
        { time: 0,    freq: 523.25, vol: 0.7 },  // C5
        { time: 0.28, freq: 659.25, vol: 0.65 }, // E5
        { time: 0.56, freq: 783.99, vol: 0.8 },  // G5
      ];
      notes.forEach(({ time, freq, vol }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + time);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.98, now + time + 1.2);
        gain.gain.setValueAtTime(0, now + time);
        gain.gain.linearRampToValueAtTime(vol, now + time + 0.02);
        gain.gain.setValueAtTime(vol, now + time + 0.3);
        gain.gain.exponentialRampToValueAtTime(0.001, now + time + 1.4);
        osc.start(now + time); osc.stop(now + time + 1.5);
        // Overtone
        const oscOv = ctx.createOscillator();
        const gainOv = ctx.createGain();
        oscOv.connect(gainOv); gainOv.connect(ctx.destination);
        oscOv.type = 'sine';
        oscOv.frequency.setValueAtTime(freq * 2, now + time);
        gainOv.gain.setValueAtTime(0, now + time);
        gainOv.gain.linearRampToValueAtTime(vol * 0.15, now + time + 0.02);
        gainOv.gain.exponentialRampToValueAtTime(0.001, now + time + 0.8);
        oscOv.start(now + time); oscOv.stop(now + time + 0.85);
      });
    }
  } catch (e) {
    console.warn('Bell playback failed:', e);
  }
}

export default function KDS() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<KDSOrder[]>([]);
  const [lastOrderVoice, setLastOrderVoice] = useState(false);
  const [bellType, setBellType] = useState<'new_order' | 'ready' | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const soundEnabledRef = useRef(true);
  const audioUnlockedRef = useRef(false);

  // Sync refs agar bisa diakses di dalam socket callback
  useEffect(() => { soundEnabledRef.current = soundEnabled; }, [soundEnabled]);
  useEffect(() => { audioUnlockedRef.current = audioUnlocked; }, [audioUnlocked]);

  // Unlock AudioContext dengan satu klik — WAJIB dilakukan sekali
  // agar bell bisa berbunyi saat stand-by
  const unlockAudio = useCallback(async () => {
    try {
      const ctx = getOrCreateAudioCtx();
      if (!ctx) return;
      if (ctx.state === 'suspended') await ctx.resume();
      // Sentuhan "silent" untuk wake up AudioContext
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.001);
      setAudioUnlocked(true);
    } catch (e) {
      console.warn('Audio unlock failed:', e);
      setAudioUnlocked(true); // anggap berhasil agar banner hilang
    }
  }, []);

  const triggerBell = useCallback((type: 'new_order' | 'ready') => {
    if (!soundEnabledRef.current) return;
    createBell(type);
    setBellType(type);
    setLastOrderVoice(true);
    setTimeout(() => {
      setLastOrderVoice(false);
      setBellType(null);
    }, 4000);
  }, []);

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/orders/kds');
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
      // Pesanan baru langsung lunas → tampilkan di KDS + bell kencang
      if (newOrder.payment_status === 'lunas') {
        fetchOrders();
        triggerBell('new_order');
      }
    });

    socket.on("order_updated", (updatedOrder: any) => {
      if (updatedOrder.payment_status === 'lunas') {
        // Kasir baru saja memverifikasi → pesanan masuk ke KDS → bell kencang
        fetchOrders();
        triggerBell('new_order');
      } else if (updatedOrder.status === 'siap') {
        // Koki selesai masak → pesanan siap diambil → chime melodik
        fetchOrders();
        triggerBell('ready');
      } else {
        // Update lainnya (dibatalkan, dll) → refresh saja
        fetchOrders();
      }
    });

    return () => {
      socket.off("new_order");
      socket.off("order_updated");
    };
  }, [triggerBell]);

  const moveOrder = async (orderId: string, nextKdsStatus: 'queue' | 'cooking' | 'ready' | 'completed') => {
    // Map KDS status to API status
    const apiStatus = 
      nextKdsStatus === 'completed' ? 'selesai' :
      nextKdsStatus === 'ready' ? 'siap' : 
      nextKdsStatus === 'cooking' ? 'sedang_diproses' : 'antrean';
    
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
              initial={{ opacity: 0, y: -40, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, y: -20 }}
              className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-indigo-600 text-white px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-4 border-2 border-white/20 backdrop-blur-md"
            >
              <div className="relative">
                <BellRing size={28} className="animate-bounce" />
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-rose-400 rounded-full animate-ping" />
              </div>
              <div className="text-left">
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">🔔 Pesanan Baru</p>
                <p className="text-base font-black tracking-tight">PESANAN MASUK KE DAPUR!</p>
              </div>
            </motion.div>
          )}
          {lastOrderVoice && bellType === 'ready' && (
            <motion.div 
              key="bell-ready"
              initial={{ opacity: 0, y: -40, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, y: -20 }}
              className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-4 border-2 border-white/20 backdrop-blur-md"
            >
              <CheckCircle2 size={28} className="animate-bounce" />
              <div className="text-left">
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">🎵 Pesanan Siap</p>
                <p className="text-base font-black tracking-tight">SIAP UNTUK DIAMBIL!</p>
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
