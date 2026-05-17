import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Upload,
  Image as ImageIcon,
  Trash2,
  Clock,
  Play,
  Plus,
  ToggleLeft,
  ToggleRight,
  Monitor,
  Eye,
  AlertCircle,
  FileVideo,
  GripVertical,
  X,
  Loader2,
  Film,
  RefreshCw,
  HardDrive,
  CheckCircle2,
  Tv2,
  BarChart3,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/src/lib/utils';

interface MediaFile {
  id: number;
  title: string;
  description: string | null;
  file_url: string;
  file_type: 'image' | 'video';
  mime_type: string;
  file_size: number;
  duration: number;
  thumbnail_url: string | null;
  uploaded_by: string;
  is_active: number;
  created_at: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '—';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

// ─── Upload Form ─────────────────────────────────────────────────────────────
function UploadForm({ onSuccess }: { onSuccess: () => void }) {
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState('10');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setError('');
    if (!title) setTitle(file.name.replace(/\.[^/.]+$/, ''));
    if (file.type.startsWith('video/')) setDuration('30');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      setSelectedFile(file);
      if (!title) setTitle(file.name.replace(/\.[^/.]+$/, ''));
      if (file.type.startsWith('video/')) setDuration('30');
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) { setError('Pilih file terlebih dahulu'); return; }
    setIsUploading(true);
    setError('');

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('title', title || selectedFile.name);
    formData.append('duration', duration);
    formData.append('uploaded_by', 'Admin');

    try {
      const res = await fetch('/api/digital-board/media/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Upload gagal');
      setUploadSuccess(true);
      setSelectedFile(null);
      setTitle('');
      setDuration('10');
      if (fileInputRef.current) fileInputRef.current.value = '';
      onSuccess();
      setTimeout(() => setUploadSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const isVideo = selectedFile?.type.startsWith('video/');

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
      <h3 className="font-bold text-slate-900 mb-5 flex items-center gap-2">
        <Upload size={18} className="text-indigo-600" />
        Unggah Konten Baru
      </h3>

      <form onSubmit={handleUpload} className="space-y-4">
        {/* Title */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Judul Konten</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="misal: Promo Nasi Goreng Spesial"
            className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
          />
        </div>

        {/* Duration */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">
            Durasi Tampil (Detik)
          </label>
          <div className="relative">
            <input
              type="number"
              min={3}
              max={300}
              value={duration}
              onChange={e => setDuration(e.target.value)}
              className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all pr-16"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-semibold">detik</span>
          </div>
        </div>

        {/* File Drop Zone */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">
            File (Gambar / Video)
          </label>
          <div
            className={cn(
              'relative border-2 border-dashed rounded-2xl p-6 flex flex-col items-center gap-3 transition-all cursor-pointer group',
              selectedFile
                ? 'border-indigo-300 bg-indigo-50/50'
                : 'border-slate-200 bg-slate-50/50 hover:border-indigo-200 hover:bg-indigo-50/30'
            )}
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              className="hidden"
              accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
            />
            <div className={cn(
              'p-3 rounded-xl transition-colors',
              selectedFile ? 'bg-indigo-100 text-indigo-600' : 'bg-white text-slate-400 group-hover:text-indigo-500 shadow-sm'
            )}>
              {selectedFile
                ? (isVideo ? <FileVideo size={24} /> : <ImageIcon size={24} />)
                : <Plus size={24} />}
            </div>
            {selectedFile ? (
              <div className="text-center">
                <p className="text-xs font-bold text-indigo-700 truncate max-w-[160px]">{selectedFile.name}</p>
                <p className="text-[10px] text-indigo-500 mt-0.5">{formatBytes(selectedFile.size)}</p>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-xs font-bold text-slate-500">Klik atau seret file ke sini</p>
                <p className="text-[10px] text-slate-400 mt-0.5">JPG, PNG, WebP, MP4, WebM — Maks 100MB</p>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-xs text-rose-600 bg-rose-50 border border-rose-100 p-3 rounded-xl">
            <AlertCircle size={14} className="shrink-0" />
            {error}
          </div>
        )}

        {uploadSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 p-3 rounded-xl"
          >
            <CheckCircle2 size={14} className="shrink-0" />
            File berhasil diupload dan disimpan ke database!
          </motion.div>
        )}

        <button
          type="submit"
          disabled={!selectedFile || isUploading}
          className="w-full py-3.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isUploading
            ? <><Loader2 className="animate-spin" size={16} /> Mengupload ke Database...</>
            : <><Upload size={16} /> Unggah & Simpan ke Database</>}
        </button>
      </form>

      <div className="mt-4 p-3 bg-amber-50 rounded-xl border border-amber-100 flex gap-2 items-start">
        <AlertCircle size={13} className="text-amber-500 shrink-0 mt-0.5" />
        <p className="text-[10px] font-semibold text-amber-700 leading-relaxed">
          File disimpan di <code className="bg-amber-100 px-1 rounded">public/uploads/digital-board/</code> dan
          data tercatat di tabel <code className="bg-amber-100 px-1 rounded">media_files</code> MySQL.
        </p>
      </div>
    </div>
  );
}

// ─── Media Card ───────────────────────────────────────────────────────────────
function MediaCard({ media, onDelete, onPreview, onToggle }: {
  media: MediaFile;
  onDelete: (id: number) => void;
  onPreview: (media: MediaFile) => void;
  onToggle: (id: number) => void;
}) {
  const isVideo = media.file_type === 'video';
  const isActive = media.is_active === 1;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -30 }}
      className={cn(
        'p-4 flex items-center gap-4 transition-all group border-l-4',
        isActive
          ? 'border-l-emerald-400 bg-white hover:bg-emerald-50/30'
          : 'border-l-slate-200 bg-slate-50/60 hover:bg-slate-100/60 opacity-60'
      )}
    >
      <div className="text-slate-200 group-hover:text-slate-300 cursor-grab shrink-0">
        <GripVertical size={16} />
      </div>

      {/* Thumbnail */}
      <div
        className={cn(
          'relative w-24 h-16 rounded-xl overflow-hidden border shrink-0 shadow-sm cursor-pointer transition-all',
          isActive ? 'border-slate-100' : 'border-slate-200 grayscale'
        )}
        onClick={() => onPreview(media)}
      >
        {isVideo ? (
          <div className="w-full h-full flex items-center justify-center bg-slate-800">
            <Film size={24} className="text-white/60" />
          </div>
        ) : (
          <img
            src={media.file_url}
            alt={media.title}
            className="w-full h-full object-cover"
            onError={e => { (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/fallback/96/64'; }}
          />
        )}
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <Eye size={14} className="text-white" />
        </div>
        {isVideo && (
          <div className="absolute top-1 right-1 bg-rose-500 text-white text-[8px] font-bold px-1 rounded">VIDEO</div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h4 className={cn('text-sm font-bold truncate', isActive ? 'text-slate-900' : 'text-slate-400')}>
            {media.title}
          </h4>
          {/* Status badge */}
          <span className={cn(
            'shrink-0 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border',
            isActive
              ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
              : 'bg-slate-100 text-slate-400 border-slate-200'
          )}>
            {isActive ? '● Aktif' : '○ Nonaktif'}
          </span>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="flex items-center gap-1 text-[10px] font-semibold text-slate-400">
            <Clock size={10} /> {media.duration}s
          </span>
          <span className="flex items-center gap-1 text-[10px] font-semibold text-slate-400">
            <HardDrive size={10} /> {formatBytes(media.file_size)}
          </span>
          <span className={cn(
            'text-[10px] font-bold px-2 py-0.5 rounded-md uppercase',
            isVideo ? 'bg-rose-50 text-rose-600' : 'bg-indigo-50 text-indigo-600'
          )}>
            {isVideo ? 'Video' : 'Gambar'}
          </span>
        </div>
        <p className="text-[10px] text-slate-400 mt-1">
          {formatDate(media.created_at)} · {media.uploaded_by}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Toggle Aktif/Nonaktif */}
        <button
          onClick={() => onToggle(media.id)}
          title={isActive ? 'Nonaktifkan konten ini' : 'Aktifkan konten ini'}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold border transition-all',
            isActive
              ? 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100'
              : 'bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200 hover:text-slate-600'
          )}
        >
          {isActive
            ? <><ToggleRight size={14} /> Aktif</>
            : <><ToggleLeft size={14} /> Nonaktif</>}
        </button>
        <button
          onClick={() => onPreview(media)}
          className="p-2 text-slate-300 hover:text-indigo-600 transition-colors rounded-lg hover:bg-indigo-50"
          title="Pratinjau"
        >
          <Play size={15} />
        </button>
        <button
          onClick={() => onDelete(media.id)}
          className="p-2 text-slate-300 hover:text-rose-500 transition-colors rounded-lg hover:bg-rose-50"
          title="Hapus"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </motion.div>
  );
}

// ─── Signage Preview Modal (Slideshow Penuh) ─────────────────────────────────
function SignagePreviewModal({ mediaList, startIndex = 0, onClose }: {
  mediaList: MediaFile[];
  startIndex?: number;
  onClose: () => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [progress, setProgress] = useState(0);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const current = mediaList[currentIndex];
  const totalDuration = current?.duration || 10;

  // Reset & mulai progress bar saat slide berganti
  useEffect(() => {
    setProgress(0);
    if (progressRef.current) clearInterval(progressRef.current);

    const step = 100 / (totalDuration * 20); // update 20x per detik
    progressRef.current = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressRef.current!);
          // Pindah ke slide berikutnya
          setCurrentIndex(i => (i + 1) % mediaList.length);
          return 0;
        }
        return prev + step;
      });
    }, 50);

    return () => { if (progressRef.current) clearInterval(progressRef.current); };
  }, [currentIndex, totalDuration, mediaList.length]);

  const goTo = (index: number) => {
    setCurrentIndex(((index % mediaList.length) + mediaList.length) % mediaList.length);
  };

  if (!current) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black flex flex-col"
    >
      {/* ── Top Bar: Progress Strips + Tutup ── */}
      <div className="absolute top-0 left-0 right-0 z-20 flex flex-col gap-2 p-4">
        {/* Progress strips per slide */}
        <div className="flex gap-1.5">
          {mediaList.map((_, i) => (
            <div
              key={i}
              className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden cursor-pointer"
              onClick={() => goTo(i)}
            >
              {i < currentIndex && (
                <div className="w-full h-full bg-white/70" />
              )}
              {i === currentIndex && (
                <motion.div
                  key={currentIndex}
                  initial={{ width: '0%' }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0 }}
                  className="h-full bg-white rounded-full"
                  style={{ width: `${progress}%` }}
                />
              )}
            </div>
          ))}
        </div>

        {/* Meta info + Close */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
            <span className="text-white/70 text-[10px] font-bold uppercase tracking-widest">
              Pratinjau Papan Digital — LIVE
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-white/50 text-[10px] font-semibold">
              {currentIndex + 1} / {mediaList.length}
            </span>
            <button
              onClick={onClose}
              className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Content Area ── */}
      <div className="flex-1 relative overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={current.id}
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.8, ease: 'easeInOut' }}
            className="absolute inset-0"
          >
            {current.file_type === 'video' ? (
              <video
                ref={videoRef}
                src={current.file_url}
                autoPlay
                muted
                loop
                className="w-full h-full object-cover"
              />
            ) : (
              <img
                src={current.file_url}
                alt={current.title}
                className="w-full h-full object-cover"
                onError={e => {
                  (e.target as HTMLImageElement).src =
                    `https://picsum.photos/seed/${current.id}/1920/1080`;
                }}
              />
            )}

            {/* Gradient overlay bawah */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent pointer-events-none" />
          </motion.div>
        </AnimatePresence>

        {/* ── Judul & Info (bawah) ── */}
        <div className="absolute bottom-0 left-0 right-0 p-10 z-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={current.id + '-title'}
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut', delay: 0.2 }}
            >
              {/* Badge tipe */}
              <div className="mb-3">
                <span className={cn(
                  'text-[10px] font-bold uppercase tracking-[0.2em] px-3 py-1 rounded-full',
                  current.file_type === 'video'
                    ? 'bg-rose-500/80 text-white'
                    : 'bg-indigo-500/80 text-white'
                )}>
                  {current.file_type === 'video' ? '▶ Video' : '◉ Gambar'}
                </span>
              </div>

              {/* Judul Utama */}
              <h2 className="text-4xl md:text-5xl font-black text-white tracking-tight leading-tight drop-shadow-2xl">
                {current.title}
              </h2>

              {/* Garis aksen */}
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: 80 }}
                transition={{ delay: 0.5, duration: 0.8 }}
                className="h-1 bg-indigo-400 mt-4 rounded-full"
              />

              {/* Durasi & urutan */}
              <p className="text-white/50 text-sm font-semibold mt-3">
                Durasi: {current.duration}s · Konten {currentIndex + 1} dari {mediaList.length}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ── Tombol Prev/Next ── */}
        <button
          onClick={() => goTo(currentIndex - 1)}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 bg-black/40 hover:bg-black/60 backdrop-blur-sm text-white rounded-full flex items-center justify-center transition-all"
        >
          ‹
        </button>
        <button
          onClick={() => goTo(currentIndex + 1)}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 bg-black/40 hover:bg-black/60 backdrop-blur-sm text-white rounded-full flex items-center justify-center transition-all"
        >
          ›
        </button>

        {/* ── Dot Navigator ── */}
        <div className="absolute bottom-4 right-10 z-20 flex gap-1.5">
          {mediaList.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={cn(
                'w-2 h-2 rounded-full transition-all',
                i === currentIndex ? 'bg-white w-5' : 'bg-white/40 hover:bg-white/70'
              )}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Stats Bar ────────────────────────────────────────────────────────────────
function StatsBar({ mediaList }: { mediaList: MediaFile[] }) {
  const videos = mediaList.filter(m => m.file_type === 'video').length;
  const images = mediaList.filter(m => m.file_type === 'image').length;
  const totalDuration = mediaList.reduce((acc, m) => acc + m.duration, 0);
  const totalSize = mediaList.reduce((acc, m) => acc + m.file_size, 0);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[
        { label: 'Total Konten', value: mediaList.length, icon: <Tv2 size={16} />, color: 'text-indigo-600 bg-indigo-50' },
        { label: 'Video', value: videos, icon: <FileVideo size={16} />, color: 'text-rose-500 bg-rose-50' },
        { label: 'Gambar', value: images, icon: <ImageIcon size={16} />, color: 'text-emerald-600 bg-emerald-50' },
        { label: 'Total Durasi', value: `${totalDuration}s`, icon: <Clock size={16} />, color: 'text-amber-600 bg-amber-50' },
      ].map(stat => (
        <div key={stat.label} className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center gap-3 shadow-sm">
          <div className={cn('p-2 rounded-xl', stat.color)}>{stat.icon}</div>
          <div>
            <p className="text-lg font-bold text-slate-900">{stat.value}</p>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{stat.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function PromotionManagement() {
  const [mediaList, setMediaList] = useState<MediaFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewStartIndex, setPreviewStartIndex] = useState(0);
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [isIdle, setIsIdle] = useState(true);
  const [idleTime, setIdleTime] = useState(0);
  const IDLE_THRESHOLD = 5;

  const fetchMedia = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/digital-board/media');
      if (!res.ok) throw new Error('Gagal fetch');
      const data = await res.json();
      setMediaList(data);
    } catch (err) {
      console.error('Gagal memuat media:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchMedia(); }, [fetchMedia]);

  // Idle timer
  useEffect(() => {
    const timer = setInterval(() => {
      setIdleTime(prev => {
        if (prev >= IDLE_THRESHOLD) { setIsIdle(true); return prev; }
        return prev + 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const openPreview = (startIndex = 0) => {
    setPreviewStartIndex(startIndex);
    setPreviewOpen(true);
  };

  const handleToggle = async (id: number) => {
    try {
      const res = await fetch(`/api/digital-board/media/${id}/toggle`, { method: 'PATCH' });
      const data = await res.json();
      if (res.ok) {
        setMediaList(prev => prev.map(m =>
          m.id === id ? { ...m, is_active: data.is_active } : m
        ));
      }
    } catch (err) {
      console.error('Gagal toggle:', err);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Hapus media ini? File akan dihapus dari server dan database.')) return;
    try {
      const res = await fetch(`/api/digital-board/media/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setMediaList(prev => prev.filter(m => m.id !== id));
      }
    } catch (err) {
      console.error('Gagal menghapus:', err);
    }
  };

  // Filter & hanya aktif untuk preview
  const filteredMedia = mediaList.filter(m => {
    if (filter === 'active') return m.is_active === 1;
    if (filter === 'inactive') return m.is_active === 0;
    return true;
  });
  const activeMedia = mediaList.filter(m => m.is_active === 1);
  const activeCount = activeMedia.length;
  const inactiveCount = mediaList.filter(m => m.is_active === 0).length;

  const resetIdle = () => { setIsIdle(false); setIdleTime(0); };

  return (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Manajer Papan Digital</h2>
          <p className="text-sm text-slate-500 mt-1">
            Upload & kelola konten promosi — tersimpan ke database MySQL <code className="bg-slate-100 text-indigo-600 px-1 py-0.5 rounded text-xs">media_files</code>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchMedia}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-100 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
          >
            <RefreshCw size={13} />
            Refresh
          </button>
          {mediaList.length > 0 && (
            <button
              onClick={() => openPreview(0)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
            >
              <Eye size={13} />
              Pratinjau Layar
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <StatsBar mediaList={mediaList} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Upload Form */}
        <div className="lg:col-span-1 space-y-6">
          <UploadForm onSuccess={fetchMedia} />

          {/* Kiosk Status */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center transition-all shadow',
                isIdle ? 'bg-indigo-600 shadow-indigo-200' : 'bg-emerald-500 shadow-emerald-200'
              )}>
                <Monitor className="text-white" size={18} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">Status Kiosk</p>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  {isIdle ? `Idle — Signage Aktif (${idleTime}s)` : 'Aktif — Pengguna Terdeteksi'}
                </p>
              </div>
            </div>
            <button
              onClick={resetIdle}
              className="px-3 py-1.5 border border-slate-100 rounded-xl text-[10px] font-bold text-slate-600 hover:bg-slate-50 transition-all whitespace-nowrap"
            >
              Simulasi User
            </button>
          </div>
        </div>

        {/* Media Library */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {/* Header + Filter Bar */}
            <div className="p-5 border-b border-slate-50 bg-slate-50/30">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                  <Monitor size={16} className="text-indigo-600" />
                  Daftar Konten Promosi
                </h3>
                <span className="text-[10px] font-bold bg-white border border-slate-100 px-3 py-1 rounded-full text-slate-500 uppercase tracking-widest shadow-sm">
                  {mediaList.length} File di DB
                </span>
              </div>
              {/* Filter tabs */}
              <div className="flex gap-1.5">
                {[
                  { key: 'all', label: 'Semua', count: mediaList.length },
                  { key: 'active', label: '✓ Aktif', count: activeCount },
                  { key: 'inactive', label: '○ Nonaktif', count: inactiveCount },
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setFilter(tab.key as any)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all',
                      filter === tab.key
                        ? tab.key === 'active'
                          ? 'bg-emerald-500 text-white border-emerald-500'
                          : tab.key === 'inactive'
                          ? 'bg-slate-500 text-white border-slate-500'
                          : 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                    )}
                  >
                    {tab.label}
                    <span className={cn(
                      'px-1.5 py-0.5 rounded-full text-[8px] font-black',
                      filter === tab.key ? 'bg-white/20' : 'bg-slate-100 text-slate-500'
                    )}>
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="divide-y divide-slate-50 min-h-[200px]">
              {isLoading ? (
                <div className="p-12 flex flex-col items-center justify-center gap-3 text-slate-400">
                  <Loader2 className="animate-spin" size={32} />
                  <p className="text-sm font-semibold">Memuat dari database...</p>
                </div>
              ) : (
              <AnimatePresence>
                  {filteredMedia.map(media => (
                    <MediaCard
                      key={media.id}
                      media={media}
                      onDelete={handleDelete}
                      onToggle={handleToggle}
                      onPreview={(m) => openPreview(activeMedia.findIndex(x => x.id === m.id))}
                    />
                  ))}
                </AnimatePresence>
              )}

              {!isLoading && filteredMedia.length === 0 && (
                <div className="p-12 flex flex-col items-center justify-center text-slate-400 gap-4">
                  <div className="p-5 bg-slate-50 rounded-2xl">
                    <Monitor size={40} className="opacity-30" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-slate-500">
                      {filter === 'inactive' ? 'Tidak ada konten nonaktif' : filter === 'active' ? 'Tidak ada konten aktif' : 'Belum ada konten'}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">Upload video atau gambar untuk mulai mengisi papan digital</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Signage Slideshow Preview */}
      <AnimatePresence>
        {previewOpen && activeMedia.length > 0 && (
          <SignagePreviewModal
            mediaList={activeMedia}
            startIndex={Math.min(previewStartIndex, activeMedia.length - 1)}
            onClose={() => setPreviewOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
