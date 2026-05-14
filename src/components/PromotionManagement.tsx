import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, 
  Image as ImageIcon, 
  Trash2, 
  Clock, 
  Play, 
  Plus, 
  Monitor, 
  Settings, 
  Eye,
  AlertCircle,
  FileVideo,
  GripVertical,
  X,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/src/lib/utils';

interface Promotion {
  id: string;
  title: string;
  url: string;
  type: string;
  duration: number;
  order_index: number;
  created_at: string;
}

export default function PromotionManagement() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [uploadData, setUploadData] = useState({ title: '', duration: '10' });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  // Kiosk Simulation State
  const [isIdle, setIsIdle] = useState(true);
  const [idleTime, setIdleTime] = useState(0);
  const IDLE_THRESHOLD = 5; // 5 seconds for demo

  useEffect(() => {
    fetchPromotions();
  }, []);

  // Idle Timer Simulation
  useEffect(() => {
    const timer = setInterval(() => {
      setIdleTime(prev => {
        if (prev >= IDLE_THRESHOLD) {
          setIsIdle(true);
          return prev;
        }
        return prev + 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const fetchPromotions = async () => {
    const res = await fetch('/api/promotions');
    const data = await res.json();
    setPromotions(data);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('title', uploadData.title);
    formData.append('duration', uploadData.duration);

    try {
      const res = await fetch('/api/promotions/upload', {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        fetchPromotions();
        setSelectedFile(null);
        setUploadData({ title: '', duration: '10' });
      }
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setIsUploading(false);
    }
  };

  const deletePromotion = async (id: string) => {
    await fetch(`/api/promotions/${id}`, { method: 'DELETE' });
    fetchPromotions();
  };

  const resetIdle = () => {
    setIsIdle(false);
    setIdleTime(0);
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Manajer Papan Digital</h2>
          <p className="text-sm text-slate-500 font-medium tracking-tight">Kelola konten promosi saat menganggur dan frekuensi signage.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowPreview(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-100 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
          >
            <Eye size={14} />
            Pratinjau Langsung
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 font-sans">
            <Settings size={14} />
            Konfigurasi Sistem
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Upload Form */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-premium">
            <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Upload size={18} className="text-indigo-600" />
              Unggah Aset Baru
            </h3>
            <form onSubmit={handleUpload} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Judul Aset</label>
                <input 
                  type="text" 
                  value={uploadData.title}
                  onChange={e => setUploadData({...uploadData, title: e.target.value})}
                  placeholder="misal: Promo Nasi Goreng"
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Durasi (Detik)</label>
                <input 
                  type="number" 
                  value={uploadData.duration}
                  onChange={e => setUploadData({...uploadData, duration: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">File (Gambar/Video)</label>
                <div className="relative group/upload">
                  <input 
                    type="file" 
                    onChange={handleFileSelect}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    accept="image/*,video/*"
                  />
                  <div className="border-2 border-dashed border-slate-100 rounded-2xl p-8 flex flex-col items-center gap-3 group-hover/upload:border-indigo-200 transition-all bg-slate-50/50">
                    <div className="p-3 bg-white rounded-xl text-slate-400 group-hover/upload:text-indigo-600 shadow-sm transition-colors">
                      <Plus size={24} />
                    </div>
                    <p className="text-xs font-bold text-slate-500">
                      {selectedFile ? selectedFile.name : 'Klik atau seret file ke sini'}
                    </p>
                    <p className="text-[10px] text-slate-400 font-medium italic">Mendukung JPG, PNG, WebP, MP4</p>
                  </div>
                </div>
              </div>
              <button 
                type="submit"
                disabled={!selectedFile || isUploading}
                className="w-full py-3.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isUploading ? <Loader2 className="animate-spin" size={18} /> : <ImageIcon size={18} />}
                {isUploading ? 'Mengompresi & Mengunggah...' : 'Unggah & Optimalkan Aset'}
              </button>
            </form>
            <div className="mt-6 p-4 bg-amber-50 rounded-xl border border-amber-100 flex gap-3">
              <AlertCircle size={14} className="text-amber-500 shrink-0 mt-0.5" />
              <p className="text-[10px] font-bold text-amber-700 leading-relaxed uppercase tracking-widest">
                Mesin Sharp: File akan dikonversi otomatis ke WebP dan dioptimalkan untuk signage 1080p.
              </p>
            </div>
          </div>
        </div>

        {/* Asset Library / Playlist */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-premium overflow-hidden">
            <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/20">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <Monitor size={18} className="text-indigo-600" />
                Daftar Putar Signage
              </h3>
              <span className="text-[10px] font-bold bg-white border border-slate-100 px-3 py-1 rounded-full text-slate-400 uppercase tracking-widest shadow-sm">
                {promotions.length} Aset Aktif
              </span>
            </div>
            
            <div className="divide-y divide-slate-50">
              <AnimatePresence>
                {promotions.map((promo, i) => (
                  <motion.div 
                    key={promo.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, x: -50 }}
                    className="p-4 flex items-center gap-4 hover:bg-slate-50/50 transition-colors group"
                  >
                    <div className="text-slate-300 group-hover:text-slate-400 cursor-grab">
                      <GripVertical size={16} />
                    </div>
                    <div className="relative w-24 h-16 rounded-xl overflow-hidden border border-slate-100 shrink-0 bg-slate-100 shadow-sm">
                      <img 
                        src={promo.url} 
                        alt="" 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Eye size={16} className="text-white" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold text-slate-900 truncate mb-1">{promo.title}</h4>
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          <Clock size={10} />
                          {promo.duration}s
                        </span>
                        <span className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 uppercase tracking-wider bg-indigo-50 px-2 py-0.5 rounded-md">
                          Urutan: {i + 1}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="p-2 text-slate-300 hover:text-indigo-600 transition-colors">
                        <Play size={16} />
                      </button>
                      <button 
                        onClick={() => deletePromotion(promo.id)}
                        className="p-2 text-slate-300 hover:text-rose-600 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {promotions.length === 0 && (
                <div className="p-12 flex flex-col items-center justify-center text-slate-400 gap-3">
                  <Monitor size={48} className="opacity-10" />
                  <p className="text-sm font-bold italic tracking-tight">Tidak ada aset di daftar putar. Tambahkan beberapa untuk memulai.</p>
                </div>
              )}
            </div>
          </div>

          {/* Kiosk Status Simulator */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-premium flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-lg",
                isIdle ? "bg-indigo-600 shadow-indigo-200" : "bg-emerald-600 shadow-emerald-200"
              )}>
                {isIdle ? <Monitor className="text-white" size={24} /> : <UserPlus className="text-white" size={24} />}
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Status Sensor Kios</h4>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  {isIdle ? `MENGANGGUR (Menyiarkan Signage: ${idleTime}s)` : 'AKTIF (Pengguna Terdeteksi)'}
                </p>
              </div>
            </div>
            <button 
              onClick={resetIdle}
              className="px-4 py-2 border border-slate-100 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all font-sans"
            >
              Simulasikan deteksi pengguna
            </button>
          </div>
        </div>
      </div>

      {/* Live Preview Modal */}
      <AnimatePresence>
        {showPreview && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-900 flex items-center justify-center p-8"
          >
            <button 
              onClick={() => setShowPreview(false)}
              className="absolute top-8 right-8 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all"
            >
              <X size={24} />
            </button>
            
            <div className="w-full max-w-5xl aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl border-8 border-white/5 relative group">
              {promotions.length > 0 ? (
                <SignageLoop promotions={promotions} onDetectUser={() => setShowPreview(false)} />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/20 font-bold text-2xl uppercase tracking-[1em]">
                  Tidak Ada Sumber
                </div>
              )}
              
              <div className="absolute bottom-10 left-10 p-4 bg-black/40 backdrop-blur-md rounded-2xl border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="text-white text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                  <div className="w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
                  Mode Papan Digital Langsung
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Sub-component for the Signage Loop Player
function SignageLoop({ promotions, onDetectUser }: { promotions: Promotion[], onDetectUser: () => void }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentPromo = promotions[currentIndex];

  useEffect(() => {
    if (!currentPromo) return;
    
    const timer = setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % promotions.length);
    }, currentPromo.duration * 1000);

    return () => clearTimeout(timer);
  }, [currentIndex, promotions]);

  return (
    <div className="w-full h-full relative cursor-none overflow-hidden" onClick={onDetectUser}>
      <AnimatePresence mode="wait">
        <motion.div
           key={currentPromo.id}
           initial={{ opacity: 0, scale: 1.1 }}
           animate={{ opacity: 1, scale: 1 }}
           exit={{ opacity: 0, scale: 0.95 }}
           transition={{ duration: 1.5, ease: "easeInOut" }}
           className="w-full h-full absolute inset-0"
        >
          <img 
            src={currentPromo.url} 
            alt={currentPromo.title} 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
          {/* Overlay branding */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
          <div className="absolute bottom-12 left-12">
             <motion.h2 
               initial={{ y: 20, opacity: 0 }}
               animate={{ y: 0, opacity: 1 }}
               transition={{ delay: 0.5 }}
               className="text-4xl font-bold text-white tracking-tight"
             >
               {currentPromo.title}
             </motion.h2>
             <motion.div 
               initial={{ width: 0 }}
               animate={{ width: '100px' }}
               transition={{ delay: 0.8, duration: 1 }}
               className="h-1 bg-indigo-500 mt-4 rounded-full"
             />
          </div>
        </motion.div>
      </AnimatePresence>
      
      {/* Progress Indicators */}
      <div className="absolute top-10 left-0 right-0 px-10 flex gap-2">
        {promotions.map((_, i) => (
          <div key={i} className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden">
             {i === currentIndex && (
               <motion.div 
                 initial={{ width: 0 }}
                 animate={{ width: '100%' }}
                 transition={{ duration: currentPromo.duration, ease: "linear" }}
                 className="h-full bg-white"
               />
             )}
             {i < currentIndex && <div className="w-full h-full bg-white/60" />}
          </div>
        ))}
      </div>
    </div>
  );
}

function UserPlus(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="19" x2="19" y1="8" y2="14" />
      <line x1="22" x2="16" y1="11" y2="11" />
    </svg>
  );
}
