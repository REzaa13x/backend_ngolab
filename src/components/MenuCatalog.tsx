import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  Grid2X2, 
  List, 
  Edit3, 
  Trash2, 
  CheckCircle2, 
  XCircle,
  Utensils
} from 'lucide-react';
import * as Switch from '@radix-ui/react-switch';
import { cn } from '@/src/lib/utils';
import { motion, AnimatePresence } from 'motion/react';

const initialMenu = [
  { id: 1, name: 'Nasi Goreng Spesial', category: 'Main Course', price: 25000, inStock: true, image: 'https://picsum.photos/seed/nasigoreng/400/300' },
  { id: 2, name: 'Ayam Bakar Madu', category: 'Main Course', price: 32000, inStock: true, image: 'https://picsum.photos/seed/ayambakar/400/300' },
  { id: 3, name: 'Es Teh Manis', category: 'Beverage', price: 5000, inStock: true, image: 'https://picsum.photos/seed/esteh/400/300' },
  { id: 4, name: 'Sate Kambing', category: 'Main Course', price: 45000, inStock: false, image: 'https://picsum.photos/seed/sate/400/300' },
  { id: 5, name: 'Jus Alpukat', category: 'Beverage', price: 15000, inStock: true, image: 'https://picsum.photos/seed/jusalpukat/400/300' },
  { id: 6, name: 'Pisang Goreng', category: 'Snack', price: 12000, inStock: true, image: 'https://picsum.photos/seed/pisang/400/300' },
];

export default function MenuCatalog() {
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    fetch('/api/menu')
      .then(res => res.json())
      .then(data => {
        setMenuItems(data);
        setLoading(false);
      })
      .catch(err => console.error("Failed to fetch menu:", err));
  }, []);

  const toggleStock = async (id: number) => {
    try {
      const res = await fetch(`/api/menu/${id}/toggle-stock`, { method: 'PATCH' });
      if (res.ok) {
        const result = await res.json();
        setMenuItems(menuItems.map(item => item.id === id ? result.item : item));
      }
    } catch (err) {
      console.error("Failed to toggle stock:", err);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Menu Catalog</h1>
          <p className="text-muted-foreground">Manage food items, pricing, and real-time availability.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-bold hover:opacity-90 transition-opacity glow-teal">
          <Plus className="w-4 h-4" />
          Add New Item
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-card border border-border p-4 rounded-xl">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search menu items..."
              className="w-full bg-background border border-border rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <button className="p-2 bg-secondary rounded-lg text-muted-foreground hover:text-foreground transition-colors">
            <Filter className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2 bg-secondary/50 p-1 rounded-lg">
          <button 
            onClick={() => setViewMode('grid')}
            className={cn("p-1.5 rounded-md transition-all", viewMode === 'grid' ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground")}
          >
            <Grid2X2 className="w-4 h-4" />
          </button>
          <button 
            onClick={() => setViewMode('list')}
            className={cn("p-1.5 rounded-md transition-all", viewMode === 'list' ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground")}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Grid Layout */}
      <div className={cn(
        "grid gap-6",
        viewMode === 'grid' ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-1"
      )}>
        {menuItems.map((item) => (
          <motion.div 
            layout
            key={item.id}
            className={cn(
              "bg-card border border-border rounded-xl overflow-hidden group transition-all duration-300",
              !item.inStock && "opacity-75 grayscale-[0.5]",
              viewMode === 'list' && "flex items-center gap-6 p-4"
            )}
          >
            <div className={cn(
              "relative overflow-hidden",
              viewMode === 'grid' ? "aspect-video" : "w-32 h-32 rounded-lg shrink-0"
            )}>
              <img 
                src={item.image} 
                alt={item.name} 
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = `https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&q=80`;
                }}
              />
              {!item.inStock && (
                <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px] flex items-center justify-center">
                  <span className="bg-red-500 text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full shadow-lg">
                    Out of Stock
                  </span>
                </div>
              )}
            </div>

            <div className="p-5 flex-1 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1 block">
                    {item.category}
                  </span>
                  <h3 className="font-bold text-base leading-tight line-clamp-2">{item.name}</h3>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-mono font-bold text-primary text-sm whitespace-nowrap">Rp {item.price.toLocaleString()}</p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-border/30">
                <div className="flex items-center gap-3">
                  <Switch.Root
                    checked={item.inStock}
                    onCheckedChange={() => toggleStock(item.id)}
                    className={cn(
                      "w-10 h-5 rounded-full relative transition-all focus:outline-none border border-border",
                      item.inStock ? "bg-primary/10 border-primary" : "bg-input"
                    )}
                  >
                    <Switch.Thumb className={cn(
                      "block w-3.5 h-3.5 rounded-full transition-all duration-200 translate-x-0.5 will-change-transform data-[state=checked]:translate-x-[22px]",
                      item.inStock ? "bg-primary shadow-[0_0_8px_var(--color-primary)]" : "bg-muted-foreground"
                    )} />
                  </Switch.Root>
                  <span className={cn("text-[11px] font-bold uppercase tracking-tighter", item.inStock ? "text-primary" : "text-muted-foreground")}>
                    {item.inStock ? 'In Stock' : 'Out of Stock'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button className="p-2 text-muted-foreground hover:text-primary transition-all">
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button className="p-2 text-muted-foreground hover:text-red-500 transition-all">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
