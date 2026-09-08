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
  theme_mode: string;
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
    theme_mode: 'light'
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
          theme_mode: data.theme_mode || 'light'
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
