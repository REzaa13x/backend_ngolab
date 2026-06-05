import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface AppSettings {
  brand_name: string;
  brand_subtitle: string;
  brand_logo_url: string;
  active_zone: string;
  dwell_time: string;
  kiosk_idle_timeout: string;
  kiosk_mode: string;
  receipt_footer: string;
  maintenance_mode: string;
  theme_color: string;
  theme_mode: string;
  sidebar_bg_color: string;
  sidebar_text_color: string;
  sidebar_active_bg_color: string;
  sidebar_active_text_color: string;
  sidebar_border_color: string;
  sidebar_hover_bg_color: string;
  sidebar_hover_text_color: string;
  sidebar_logo_text_color: string;
  sidebar_section_text_color: string;
}

interface SettingsContextType {
  settings: AppSettings;
  loading: boolean;
  updateSettings: (newSettings: Partial<AppSettings>) => Promise<boolean>;
  refreshSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>({
    brand_name: 'ngolab',
    brand_subtitle: 'Gesture-Eats',
    brand_logo_url: '',
    active_zone: '60',
    dwell_time: '1.5',
    kiosk_idle_timeout: '60',
    kiosk_mode: 'gesture',
    receipt_footer: 'Terima kasih atas kunjungan Anda!',
    maintenance_mode: '0',
    theme_color: '#4f46e5',
    theme_mode: 'light',
    sidebar_bg_color: '#ffffff',
    sidebar_text_color: '#64748b',
    sidebar_active_bg_color: '#f0f2fe',
    sidebar_active_text_color: '#4f46e5',
    sidebar_border_color: '#f1f5f9',
    sidebar_hover_bg_color: '#f8fafc',
    sidebar_hover_text_color: '#0f172a',
    sidebar_logo_text_color: '#0f172a',
    sidebar_section_text_color: '#94a3b8'
  });
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings({
          brand_name: data.brand_name || 'ngolab',
          brand_subtitle: data.brand_subtitle || 'Gesture-Eats',
          brand_logo_url: data.brand_logo_url || '',
          active_zone: data.active_zone || '60',
          dwell_time: data.dwell_time || '1.5',
          kiosk_idle_timeout: data.kiosk_idle_timeout || '60',
          kiosk_mode: data.kiosk_mode || 'gesture',
          receipt_footer: data.receipt_footer || 'Terima kasih atas kunjungan Anda!',
          maintenance_mode: data.maintenance_mode || '0',
          theme_color: data.theme_color || '#4f46e5',
          theme_mode: data.theme_mode || 'light',
          sidebar_bg_color: data.sidebar_bg_color || '#ffffff',
          sidebar_text_color: data.sidebar_text_color || '#64748b',
          sidebar_active_bg_color: data.sidebar_active_bg_color || '#f0f2fe',
          sidebar_active_text_color: data.sidebar_active_text_color || '#4f46e5',
          sidebar_border_color: data.sidebar_border_color || '#f1f5f9',
          sidebar_hover_bg_color: data.sidebar_hover_bg_color || '#f8fafc',
          sidebar_hover_text_color: data.sidebar_hover_text_color || '#0f172a',
          sidebar_logo_text_color: data.sidebar_logo_text_color || '#0f172a',
          sidebar_section_text_color: data.sidebar_section_text_color || '#94a3b8'
        });
      }
    } catch (err) {
      console.error("Gagal memuat pengaturan aplikasi:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  // Sync theme colors dynamically across the entire app
  useEffect(() => {
    // Helper functions for HSL <-> Hex color conversion and generating shades
    const hexToHsl = (hexStr: string) => {
      let hex = hexStr.replace(/^#/, '');
      if (hex.length === 3) {
        hex = hex.split('').map(char => char + char).join('');
      }
      let r = parseInt(hex.substring(0, 2), 16) / 255;
      let g = parseInt(hex.substring(2, 4), 16) / 255;
      let b = parseInt(hex.substring(4, 6), 16) / 255;

      let max = Math.max(r, g, b);
      let min = Math.min(r, g, b);
      let h = 0;
      let s = 0;
      let l = (max + min) / 2;

      if (max !== min) {
        let d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
          case r:
            h = (g - b) / d + (g < b ? 6 : 0);
            break;
          case g:
            h = (b - r) / d + 2;
            break;
          case b:
            h = (r - g) / d + 4;
            break;
        }
        h /= 6;
      }

      return {
        h: Math.round(h * 360),
        s: Math.round(s * 100),
        l: Math.round(l * 100),
      };
    };

    const hslToHex = (h: number, s: number, l: number) => {
      s /= 100;
      l /= 100;
      let c = (1 - Math.abs(2 * l - 1)) * s;
      let x = c * (1 - Math.abs(((h / 60) % 2) - 1));
      let m = l - c / 2;
      let r = 0, g = 0, b = 0;

      if (h >= 0 && h < 60) {
        r = c; g = x; b = 0;
      } else if (h >= 60 && h < 120) {
        r = x; g = c; b = 0;
      } else if (h >= 120 && h < 180) {
        r = 0; g = c; b = x;
      } else if (h >= 180 && h < 240) {
        r = 0; g = x; b = c;
      } else if (h >= 240 && h < 300) {
        r = x; g = 0; b = c;
      } else if (h >= 300 && h < 360) {
        r = c; g = 0; b = x;
      }

      let rHex = Math.round((r + m) * 255).toString(16).padStart(2, '0');
      let gHex = Math.round((g + m) * 255).toString(16).padStart(2, '0');
      let bHex = Math.round((b + m) * 255).toString(16).padStart(2, '0');

      return `#${rHex}${gHex}${bHex}`;
    };

    const generateShades = (hex: string) => {
      const { h, s, l } = hexToHsl(hex);
      return {
        'primary': hex,
        'ring': hex,
        'indigo-50': hslToHex(h, s, Math.min(99, l + (100 - l) * 0.9)),
        'indigo-100': hslToHex(h, s, Math.min(97, l + (100 - l) * 0.8)),
        'indigo-200': hslToHex(h, s, Math.min(93, l + (100 - l) * 0.6)),
        'indigo-300': hslToHex(h, s, Math.min(88, l + (100 - l) * 0.4)),
        'indigo-400': hslToHex(h, s, Math.min(80, l + (100 - l) * 0.2)),
        'indigo-500': hex,
        'indigo-600': hslToHex(h, s, Math.max(5, l * 0.85)),
        'indigo-700': hslToHex(h, s, Math.max(4, l * 0.7)),
        'indigo-800': hslToHex(h, s, Math.max(3, l * 0.55)),
        'indigo-900': hslToHex(h, s, Math.max(2, l * 0.4)),
        'indigo-950': hslToHex(h, s, Math.max(1, l * 0.25)),
      };
    };

    const colorShades: Record<string, Record<string, string>> = {
      '#4f46e5': { // Indigo
        'primary': '#4f46e5',
        'ring': '#4f46e5',
        'indigo-50': '#eef2ff',
        'indigo-100': '#e0e7ff',
        'indigo-200': '#c7d2fe',
        'indigo-300': '#a5b4fc',
        'indigo-400': '#818cf8',
        'indigo-500': '#6366f1',
        'indigo-600': '#4f46e5',
        'indigo-700': '#4338ca',
        'indigo-800': '#3730a3',
        'indigo-900': '#312e81',
        'indigo-950': '#1e1b4b',
      },
      '#f97316': { // Orange
        'primary': '#f97316',
        'ring': '#f97316',
        'indigo-50': '#fff7ed',
        'indigo-100': '#ffedd5',
        'indigo-200': '#fed7aa',
        'indigo-300': '#fdba74',
        'indigo-400': '#fb923c',
        'indigo-500': '#f97316',
        'indigo-600': '#ea580c',
        'indigo-700': '#c2410c',
        'indigo-800': '#9a3412',
        'indigo-900': '#7c2d12',
        'indigo-950': '#431407',
      },
      '#10b981': { // Emerald
        'primary': '#10b981',
        'ring': '#10b981',
        'indigo-50': '#ecfdf5',
        'indigo-100': '#d1fae5',
        'indigo-200': '#a7f3d0',
        'indigo-300': '#6ee7b7',
        'indigo-400': '#34d399',
        'indigo-500': '#10b981',
        'indigo-600': '#059669',
        'indigo-700': '#047857',
        'indigo-800': '#065f46',
        'indigo-900': '#064e3b',
        'indigo-950': '#022c22',
      },
      '#3b82f6': { // Blue
        'primary': '#3b82f6',
        'ring': '#3b82f6',
        'indigo-50': '#eff6ff',
        'indigo-100': '#dbeafe',
        'indigo-200': '#bfdbfe',
        'indigo-300': '#93c5fd',
        'indigo-400': '#60a5fa',
        'indigo-500': '#3b82f6',
        'indigo-600': '#2563eb',
        'indigo-700': '#1d4ed8',
        'indigo-800': '#1e40af',
        'indigo-900': '#1e3a8a',
        'indigo-950': '#172554',
      },
      '#f43f5e': { // Rose
        'primary': '#f43f5e',
        'ring': '#f43f5e',
        'indigo-50': '#fff1f2',
        'indigo-100': '#ffe4e6',
        'indigo-200': '#fecdd3',
        'indigo-300': '#fda4af',
        'indigo-400': '#fb7185',
        'indigo-500': '#f43f5e',
        'indigo-600': '#e11d48',
        'indigo-700': '#be123c',
        'indigo-800': '#9f1239',
        'indigo-900': '#881337',
        'indigo-950': '#4c0519',
      }
    };

    const selectedShades = colorShades[settings.theme_color] || generateShades(settings.theme_color);

    Object.entries(selectedShades).forEach(([key, val]) => {
      document.documentElement.style.setProperty(`--color-${key}`, val);
    });
  }, [settings.theme_color]);

  // Sync sidebar styles dynamically across the entire app
  useEffect(() => {
    const vars = {
      'sidebar-bg': settings.sidebar_bg_color,
      'sidebar-text': settings.sidebar_text_color,
      'sidebar-active-bg': settings.sidebar_active_bg_color,
      'sidebar-active-text': settings.sidebar_active_text_color,
      'sidebar-border': settings.sidebar_border_color,
      'sidebar-hover-bg': settings.sidebar_hover_bg_color,
      'sidebar-hover-text': settings.sidebar_hover_text_color,
      'sidebar-logo-text': settings.sidebar_logo_text_color,
      'sidebar-section-text': settings.sidebar_section_text_color,
    };

    Object.entries(vars).forEach(([key, val]) => {
      document.documentElement.style.setProperty(`--${key}`, val);
    });
  }, [
    settings.sidebar_bg_color,
    settings.sidebar_text_color,
    settings.sidebar_active_bg_color,
    settings.sidebar_active_text_color,
    settings.sidebar_border_color,
    settings.sidebar_hover_bg_color,
    settings.sidebar_hover_text_color,
    settings.sidebar_logo_text_color,
    settings.sidebar_section_text_color
  ]);

  // Sync global dark/light theme mode
  useEffect(() => {
    if (settings.theme_mode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings.theme_mode]);

  const updateSettings = async (newSettings: Partial<AppSettings>): Promise<boolean> => {
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-name': localStorage.getItem('tangolab_admin_user') 
            ? JSON.parse(localStorage.getItem('tangolab_admin_user')!).name 
            : 'Admin'
        },
        body: JSON.stringify(newSettings)
      });
      if (res.ok) {
        setSettings(prev => ({ ...prev, ...newSettings }));
        return true;
      }
      return false;
    } catch (err) {
      console.error("Gagal memperbarui pengaturan:", err);
      return false;
    }
  };

  return (
    <SettingsContext.Provider value={{ settings, loading, updateSettings, refreshSettings: fetchSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
