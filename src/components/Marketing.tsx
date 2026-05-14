import React, { useState } from 'react';
import { 
  Upload, 
  Trash2, 
  Play, 
  Pause, 
  Clock, 
  Image as ImageIcon, 
  Video, 
  Plus,
  Monitor,
  Layout
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { motion } from 'motion/react';

const initialPromos = [
  { id: 1, type: 'image', title: 'Special Lunch Promo', duration: '10s', url: 'https://picsum.photos/seed/promo1/800/450' },
  { id: 2, type: 'video', title: 'New Menu Teaser', duration: '30s', url: 'https://picsum.photos/seed/promo2/800/450' },
  { id: 3, type: 'image', title: 'Loyalty Program', duration: '15s', url: 'https://picsum.photos/seed/promo3/800/450' },
];

export default function Marketing() {
  const [promos, setPromos] = useState(initialPromos);
  const [idleTime, setIdleTime] = useState('60');

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Idle-Promotion Manager</h1>
          <p className="text-muted-foreground">Manage digital signage content for kiosk idle states.</p>
        </div>
        <div className="flex items-center gap-3 bg-card border border-border p-1.5 rounded-lg">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary rounded-md">
            <Clock className="w-4 h-4 text-primary" />
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Time-to-Idle</span>
          </div>
          <div className="flex items-center gap-2 px-3">
            <input 
              type="number" 
              value={idleTime}
              onChange={(e) => setIdleTime(e.target.value)}
              className="w-12 bg-transparent text-sm font-bold text-center focus:outline-none"
            />
            <span className="text-xs text-muted-foreground font-medium">sec</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Preview Section */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card border border-border rounded-xl overflow-hidden aspect-video relative group shadow-2xl">
            <img 
              src={promos[0].url} 
              alt="Preview" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-8">
              <div className="flex items-center gap-4 mb-2">
                <span className="px-3 py-1 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest rounded-full">
                  Live Preview
                </span>
                <span className="text-white/60 text-xs flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {promos[0].duration}
                </span>
              </div>
              <h2 className="text-2xl font-bold text-white">{promos[0].title}</h2>
            </div>
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-sm">
              <button className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center glow-teal">
                <Play className="w-8 h-8 fill-current" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-secondary/20 border border-border rounded-xl p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <Monitor className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Display Status</p>
                <p className="text-lg font-bold flex items-center gap-2">
                  Active
                  <span className="w-2 h-2 bg-success rounded-full animate-pulse glow-green" />
                </p>
              </div>
            </div>
            <div className="bg-secondary/20 border border-border rounded-xl p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <Layout className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Active Playlist</p>
                <p className="text-lg font-bold">{promos.length} Items</p>
              </div>
            </div>
          </div>
        </div>

        {/* Content List */}
        <div className="bg-card border border-border rounded-xl flex flex-col">
          <div className="p-4 border-b border-border flex items-center justify-between bg-secondary/10">
            <h3 className="text-[12px] uppercase tracking-[0.5px] text-muted-foreground font-semibold">Playlist</h3>
            <button className="p-1.5 bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity shadow-[0_0_10px_var(--color-primary)]">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[500px]">
            {promos.map((promo, i) => (
              <div key={promo.id} className="group relative bg-secondary/30 border border-border rounded-lg p-3 flex items-center gap-4 hover:border-primary/50 transition-all cursor-pointer">
                <div className="w-16 h-10 rounded bg-background overflow-hidden shrink-0 border border-border">
                  <img src={promo.url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{promo.title}</p>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-bold uppercase">
                    {promo.type === 'video' ? <Video className="w-3 h-3" /> : <ImageIcon className="w-3 h-3" />}
                    {promo.type} • {promo.duration}
                  </div>
                </div>
                <button className="opacity-0 group-hover:opacity-100 p-1.5 text-muted-foreground hover:text-red-500 transition-all">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}

            <div className="border-2 border-dashed border-border rounded-lg p-8 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary hover:border-primary/50 transition-all cursor-pointer">
              <Upload className="w-8 h-8" />
              <p className="text-xs font-bold uppercase tracking-widest">Upload Media</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
