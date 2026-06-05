import React, { useState, useEffect } from 'react';
import * as Slider from '@radix-ui/react-slider';
import * as Tooltip from '@radix-ui/react-tooltip';
import { 
  Cpu, 
  Info, 
  Target, 
  MousePointer2, 
  RefreshCcw, 
  HelpCircle, 
  Paintbrush, 
  Laptop, 
  UploadCloud, 
  Check, 
  AlertTriangle,
  Play,
  Square,
  Activity,
  Sun,
  Moon
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useSettings } from '../contexts/SettingsContext';

type ActiveTabSettings = 'brand' | 'sensor' | 'system';

export default function IoTConfig() {
  const { settings, updateSettings, refreshSettings } = useSettings();
  const [activeTab, setActiveTab] = useState<ActiveTabSettings>('brand');
  
  // Local state initialized from SettingsContext
  const [brandName, setBrandName] = useState(settings.brand_name);
  const [brandSubtitle, setBrandSubtitle] = useState(settings.brand_subtitle);
  const [themeColor, setThemeColor] = useState(settings.theme_color);
  const [themeMode, setThemeMode] = useState(settings.theme_mode || 'light');
  const [receiptFooter, setReceiptFooter] = useState(settings.receipt_footer);
  
  const [activeZone, setActiveZone] = useState([parseInt(settings.active_zone) || 60]);
  const [dwellTime, setDwellTime] = useState([parseFloat(settings.dwell_time) || 1.5]);
  
  const [kioskIdleTimeout, setKioskIdleTimeout] = useState(settings.kiosk_idle_timeout);
  const [kioskMode, setKioskMode] = useState(settings.kiosk_mode);
  const [maintenanceMode, setMaintenanceMode] = useState(settings.maintenance_mode === '1');

  // Sidebar Customizer local states
  const [sidebarBgColor, setSidebarBgColor] = useState(settings.sidebar_bg_color || '#ffffff');
  const [sidebarTextColor, setSidebarTextColor] = useState(settings.sidebar_text_color || '#64748b');
  const [sidebarActiveBgColor, setSidebarActiveBgColor] = useState(settings.sidebar_active_bg_color || '#f0f2fe');
  const [sidebarActiveTextColor, setSidebarActiveTextColor] = useState(settings.sidebar_active_text_color || '#4f46e5');
  const [sidebarBorderColor, setSidebarBorderColor] = useState(settings.sidebar_border_color || '#f1f5f9');
  const [sidebarHoverBgColor, setSidebarHoverBgColor] = useState(settings.sidebar_hover_bg_color || '#f8fafc');
  const [sidebarHoverTextColor, setSidebarHoverTextColor] = useState(settings.sidebar_hover_text_color || '#0f172a');
  const [sidebarLogoTextColor, setSidebarLogoTextColor] = useState(settings.sidebar_logo_text_color || '#0f172a');
  const [sidebarSectionTextColor, setSidebarSectionTextColor] = useState(settings.sidebar_section_text_color || '#94a3b8');

  // File Upload State
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState(settings.brand_logo_url || '');
  const [isUploading, setIsUploading] = useState(false);
  
  // Saving Status
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  // Simulator State
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulatedDistance, setSimulatedDistance] = useState(90);
  const [simulatedProgress, setSimulatedProgress] = useState(0);

  // Sync state if context loads after mounting
  useEffect(() => {
    setBrandName(settings.brand_name);
    setBrandSubtitle(settings.brand_subtitle);
    setThemeColor(settings.theme_color);
    setThemeMode(settings.theme_mode || 'light');
    setReceiptFooter(settings.receipt_footer);
    setActiveZone([parseInt(settings.active_zone) || 60]);
    setDwellTime([parseFloat(settings.dwell_time) || 1.5]);
    setKioskIdleTimeout(settings.kiosk_idle_timeout);
    setKioskMode(settings.kiosk_mode);
    setMaintenanceMode(settings.maintenance_mode === '1');
    setLogoPreview(settings.brand_logo_url || '');

    setSidebarBgColor(settings.sidebar_bg_color || '#ffffff');
    setSidebarTextColor(settings.sidebar_text_color || '#64748b');
    setSidebarActiveBgColor(settings.sidebar_active_bg_color || '#f0f2fe');
    setSidebarActiveTextColor(settings.sidebar_active_text_color || '#4f46e5');
    setSidebarBorderColor(settings.sidebar_border_color || '#f1f5f9');
    setSidebarHoverBgColor(settings.sidebar_hover_bg_color || '#f8fafc');
    setSidebarHoverTextColor(settings.sidebar_hover_text_color || '#0f172a');
    setSidebarLogoTextColor(settings.sidebar_logo_text_color || '#0f172a');
    setSidebarSectionTextColor(settings.sidebar_section_text_color || '#94a3b8');
  }, [settings]);

  // Color options
  const colors = [
    { name: 'Indigo', value: '#4f46e5', bg: 'bg-indigo-600' },
    { name: 'Orange', value: '#f97316', bg: 'bg-orange-500' },
    { name: 'Emerald', value: '#10b981', bg: 'bg-emerald-500' },
    { name: 'Blue', value: '#3b82f6', bg: 'bg-blue-600' },
    { name: 'Rose', value: '#f43f5e', bg: 'bg-rose-500' },
  ];

  // Sensor testing simulation loop
  useEffect(() => {
    let interval: NodeJS.Timeout;
    let clickTimeout: NodeJS.Timeout;

    if (isSimulating) {
      let direction = -1; // -1 = moving closer, 1 = moving away
      let currentDist = 95;
      let startConfirmTime = 0;

      interval = setInterval(() => {
        // Random drift
        const drift = (Math.random() - 0.5) * 4;
        currentDist += direction * 3 + drift;

        // Bounce boundaries
        if (currentDist <= 30) {
          direction = 1;
        } else if (currentDist >= 100) {
          direction = -1;
        }

        setSimulatedDistance(Math.round(currentDist));

        // Check if hand is inside active zone
        const targetZone = activeZone[0];
        if (currentDist <= targetZone) {
          if (startConfirmTime === 0) {
            startConfirmTime = Date.now();
          }
          const elapsed = (Date.now() - startConfirmTime) / 1000;
          const targetDwell = dwellTime[0];
          const progress = Math.min(100, Math.round((elapsed / targetDwell) * 100));
          setSimulatedProgress(progress);

          if (progress >= 100) {
            // Trigger target gesture hit
            direction = 1; // Move back after confirm
            startConfirmTime = 0;
            // Short flash
            setSimulatedProgress(100);
          }
        } else {
          startConfirmTime = 0;
          setSimulatedProgress(0);
        }
      }, 100);
    } else {
      setSimulatedProgress(0);
    }

    return () => {
      clearInterval(interval);
      clearTimeout(clickTimeout);
    };
  }, [isSimulating, activeZone, dwellTime]);

  // Live Preview Theme Colors
  const applyThemePreview = (colorHex: string) => {
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
      '#4f46e5': {
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
      '#f97316': {
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
      '#10b981': {
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
      '#3b82f6': {
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
      '#f43f5e': {
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

    const selectedShades = colorShades[colorHex] || generateShades(colorHex);

    Object.entries(selectedShades).forEach(([key, val]) => {
      document.documentElement.style.setProperty(`--color-${key}`, val);
    });
  };

  const applySidebarPreview = (key: string, val: string) => {
    document.documentElement.style.setProperty(`--${key}`, val);
  };

  const applyThemeModePreview = (mode: string) => {
    if (mode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage('');

    try {
      // 1. Upload Logo if changed
      let finalLogoUrl = settings.brand_logo_url;
      if (logoFile) {
        setIsUploading(true);
        const formData = new FormData();
        formData.append('logo', logoFile);

        const uploadRes = await fetch('/api/settings/upload-logo', {
          method: 'POST',
          headers: {
            'x-user-name': localStorage.getItem('tangolab_admin_user') 
              ? JSON.parse(localStorage.getItem('tangolab_admin_user')!).name 
              : 'Admin'
          },
          body: formData
        });
        
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          finalLogoUrl = uploadData.brand_logo_url;
          setLogoFile(null);
        } else {
          console.error("Gagal mengunggah logo");
        }
        setIsUploading(false);
      }

      // 2. Save all other settings
      const newSettings = {
        brand_name: brandName,
        brand_subtitle: brandSubtitle,
        brand_logo_url: finalLogoUrl,
        theme_color: themeColor,
        theme_mode: themeMode,
        receipt_footer: receiptFooter,
        active_zone: activeZone[0].toString(),
        dwell_time: dwellTime[0].toString(),
        kiosk_idle_timeout: kioskIdleTimeout,
        kiosk_mode: kioskMode,
        maintenance_mode: maintenanceMode ? '1' : '0',
        sidebar_bg_color: sidebarBgColor,
        sidebar_text_color: sidebarTextColor,
        sidebar_active_bg_color: sidebarActiveBgColor,
        sidebar_active_text_color: sidebarActiveTextColor,
        sidebar_border_color: sidebarBorderColor,
        sidebar_hover_bg_color: sidebarHoverBgColor,
        sidebar_hover_text_color: sidebarHoverTextColor,
        sidebar_logo_text_color: sidebarLogoTextColor,
        sidebar_section_text_color: sidebarSectionTextColor
      };

      const success = await updateSettings(newSettings);
      if (success) {
        setSaveMessage('Pengaturan berhasil disimpan!');
        refreshSettings();
        setTimeout(() => setSaveMessage(''), 3000);
      } else {
        alert('Gagal menyimpan pengaturan aplikasi');
      }
    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan koneksi server');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (confirm('Apakah Anda yakin ingin mengembalikan seluruh pengaturan ke default pabrik?')) {
      setIsSaving(true);
      const defaults = {
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
      };

      const success = await updateSettings(defaults);
      if (success) {
        setBrandName(defaults.brand_name);
        setBrandSubtitle(defaults.brand_subtitle);
        setThemeColor(defaults.theme_color);
        setThemeMode(defaults.theme_mode);
        setReceiptFooter(defaults.receipt_footer);
        setActiveZone([60]);
        setDwellTime([1.5]);
        setKioskIdleTimeout(defaults.kiosk_idle_timeout);
        setKioskMode(defaults.kiosk_mode);
        setMaintenanceMode(false);
        setLogoPreview('');
        setLogoFile(null);
        setSidebarBgColor(defaults.sidebar_bg_color);
        setSidebarTextColor(defaults.sidebar_text_color);
        setSidebarActiveBgColor(defaults.sidebar_active_bg_color);
        setSidebarActiveTextColor(defaults.sidebar_active_text_color);
        setSidebarBorderColor(defaults.sidebar_border_color);
        setSidebarHoverBgColor(defaults.sidebar_hover_bg_color);
        setSidebarHoverTextColor(defaults.sidebar_hover_text_color);
        setSidebarLogoTextColor(defaults.sidebar_logo_text_color);
        setSidebarSectionTextColor(defaults.sidebar_section_text_color);
        setSaveMessage('Pengaturan di-reset ke default pabrik!');
        refreshSettings();
        setTimeout(() => setSaveMessage(''), 3000);
      }
      setIsSaving(false);
    }
  };

  return (
    <Tooltip.Provider>
      <div className="space-y-8 animate-in fade-in duration-500 pb-16">
        
        {/* Toast Alert */}
        <AnimatePresence>
          {saveMessage && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: -20 }} 
              className="fixed top-6 right-6 z-[120] bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-lg text-sm font-bold flex items-center gap-2"
            >
              <Check size={16}/> {saveMessage}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Pengaturan Admin</h1>
            <p className="text-slate-500 text-sm font-medium mt-1">
              Kelola kustomisasi identitas brand cafe, kalibrasi jarak sensor IoT, dan parameter kiosk.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={handleReset}
              className="flex items-center gap-2 px-5 py-3 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all"
            >
              <RefreshCcw className="w-4 h-4" />
              Reset Pabrik
            </button>
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-lg hover:shadow-indigo-200 disabled:opacity-60"
            >
              {isSaving ? 'Menyimpan...' : 'Simpan Konfigurasi'}
            </button>
          </div>
        </div>

        {/* Dashboard Tabs */}
        <div className="flex border-b border-slate-100 gap-1 p-1 bg-slate-50 rounded-2xl w-fit border">
          <button
            onClick={() => setActiveTab('brand')}
            className={cn(
              "flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
              activeTab === 'brand' 
                ? "bg-white text-indigo-600 shadow-sm border border-slate-100" 
                : "text-slate-400 hover:text-slate-700"
            )}
          >
            <Paintbrush size={16} />
            Kustomisasi Brand
          </button>
          <button
            onClick={() => setActiveTab('sensor')}
            className={cn(
              "flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
              activeTab === 'sensor' 
                ? "bg-white text-indigo-600 shadow-sm border border-slate-100" 
                : "text-slate-400 hover:text-slate-700"
            )}
          >
            <Cpu size={16} />
            Sensor & IoT
          </button>
          <button
            onClick={() => setActiveTab('system')}
            className={cn(
              "flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
              activeTab === 'system' 
                ? "bg-white text-indigo-600 shadow-sm border border-slate-100" 
                : "text-slate-400 hover:text-slate-700"
            )}
          >
            <Laptop size={16} />
            Sistem Kiosk
          </button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
          
          {/* Main settings options depending on active tab */}
          <div className="xl:col-span-2 space-y-6">
            
            {/* TAB 1: BRAND CONFIGURATION */}
            {activeTab === 'brand' && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white border border-slate-100 rounded-3xl p-8 space-y-6 shadow-premium"
              >
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Identitas Visual & Brand</h3>
                  <p className="text-xs text-slate-400 font-medium">Ubah logo brand, nama, dan detail warna tema aplikasi.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Nama Brand Cafe</label>
                    <input 
                      type="text" 
                      value={brandName}
                      onChange={e => setBrandName(e.target.value)}
                      placeholder="Contoh: ngolab"
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Brand Slogan / Subtitle</label>
                    <input 
                      type="text" 
                      value={brandSubtitle}
                      onChange={e => setBrandSubtitle(e.target.value)}
                      placeholder="Contoh: Gesture-Eats"
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-semibold"
                    />
                  </div>
                </div>

                {/* Logo Upload Dropzone */}
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Logo Kustom Aplikasi</label>
                  <div className="flex flex-col md:flex-row gap-6 items-center p-6 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                    <div className="w-20 h-20 rounded-xl bg-white border border-slate-200 overflow-hidden flex items-center justify-center shrink-0 shadow-sm">
                      {logoPreview ? (
                        <img src={logoPreview} alt="Preview logo" className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center leading-none text-slate-300 font-black text-xs uppercase select-none">
                          Logo
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 text-center md:text-left">
                      <p className="text-xs font-bold text-slate-700">Unggah Logo Brand Baru</p>
                      <p className="text-[10px] text-slate-400 font-medium mt-1 mb-3">Format PNG, JPG, atau WebP (Dimensi disarankan 1:1, Maks 2MB)</p>
                      <label className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer hover:bg-indigo-100 transition-colors">
                        <UploadCloud size={14} />
                        Pilih File Gambar
                        <input type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
                      </label>
                    </div>
                  </div>
                </div>

                {/* Theme Color Picker */}
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Pilihan Warna Aksen Tema</label>
                  <div className="flex flex-wrap gap-3 items-center">
                    {colors.map(color => (
                      <button
                        key={color.value}
                        type="button"
                        onClick={() => {
                          setThemeColor(color.value);
                          applyThemePreview(color.value);
                        }}
                        className={cn(
                          "flex items-center gap-2 px-4 py-3 rounded-xl border transition-all text-xs font-bold shadow-sm",
                          themeColor === color.value 
                            ? "border-slate-800 bg-slate-900 text-white" 
                            : "border-slate-100 bg-white text-slate-600 hover:bg-slate-50"
                        )}
                      >
                        <span className={cn("w-3.5 h-3.5 rounded-full shrink-0", color.bg)} />
                        {color.name}
                        {themeColor === color.value && <Check size={12} className="ml-1 text-indigo-400" />}
                      </button>
                    ))}

                    {/* Custom Color Input */}
                    <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-1.5 bg-white shadow-sm hover:border-slate-300 transition-all">
                      <div className="relative flex items-center justify-center">
                        <input
                          type="color"
                          value={themeColor}
                          onChange={e => {
                            setThemeColor(e.target.value);
                            applyThemePreview(e.target.value);
                          }}
                          className="w-8 h-8 border border-slate-200 rounded-lg cursor-pointer bg-white shrink-0"
                        />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider leading-none mb-0.5">Warna Kustom</span>
                        <input
                          type="text"
                          value={themeColor}
                          onChange={e => {
                            let val = e.target.value;
                            setThemeColor(val);
                            if (/^#[0-9A-F]{6}$/i.test(val)) {
                              applyThemePreview(val);
                            }
                          }}
                          placeholder="#4f46e5"
                          className="w-20 bg-transparent text-xs font-mono font-bold text-slate-700 focus:outline-none p-0"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Mode Tampilan Aplikasi (Light / Dark Mode) */}
                <div className="border-t border-slate-100 pt-6">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Mode Tampilan Aplikasi (Seluruh Halaman)</label>
                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={() => {
                        setThemeMode('light');
                        applyThemeModePreview('light');
                      }}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl border transition-all text-xs font-black uppercase tracking-wider shadow-sm",
                        themeMode === 'light'
                          ? "border-slate-800 bg-slate-900 text-white"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      <Sun size={14} className={cn(themeMode === 'light' ? "text-amber-400" : "text-slate-400")} />
                      Mode Terang (Light)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setThemeMode('dark');
                        applyThemeModePreview('dark');
                      }}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl border transition-all text-xs font-black uppercase tracking-wider shadow-sm",
                        themeMode === 'dark'
                          ? "border-slate-800 bg-slate-900 text-white"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      <Moon size={14} className={cn(themeMode === 'dark' ? "text-indigo-400" : "text-slate-400")} />
                      Mode Gelap (Dark)
                    </button>
                  </div>
                </div>

                {/* Kustomisasi Sidebar */}
                <div className="border-t border-slate-100 pt-6 space-y-4">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Kustomisasi Warna Sidebar</h4>
                    <p className="text-xs text-slate-400 font-medium">Ubah skema warna background, teks, dan menu aktif sidebar.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Background Sidebar</label>
                      <div className="flex gap-2 items-center">
                        <input 
                          type="color" 
                          value={sidebarBgColor}
                          onChange={e => {
                            setSidebarBgColor(e.target.value);
                            applySidebarPreview('sidebar-bg', e.target.value);
                          }}
                          className="w-10 h-10 border border-slate-200 rounded-lg cursor-pointer bg-white shrink-0"
                        />
                        <input 
                          type="text" 
                          value={sidebarBgColor}
                          onChange={e => {
                            setSidebarBgColor(e.target.value);
                            applySidebarPreview('sidebar-bg', e.target.value);
                          }}
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs font-mono font-bold focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Teks & Ikon Menu</label>
                      <div className="flex gap-2 items-center">
                        <input 
                          type="color" 
                          value={sidebarTextColor}
                          onChange={e => {
                            setSidebarTextColor(e.target.value);
                            applySidebarPreview('sidebar-text', e.target.value);
                          }}
                          className="w-10 h-10 border border-slate-200 rounded-lg cursor-pointer bg-white shrink-0"
                        />
                        <input 
                          type="text" 
                          value={sidebarTextColor}
                          onChange={e => {
                            setSidebarTextColor(e.target.value);
                            applySidebarPreview('sidebar-text', e.target.value);
                          }}
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs font-mono font-bold focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Warna Section Header</label>
                      <div className="flex gap-2 items-center">
                        <input 
                          type="color" 
                          value={sidebarSectionTextColor}
                          onChange={e => {
                            setSidebarSectionTextColor(e.target.value);
                            applySidebarPreview('sidebar-section-text', e.target.value);
                          }}
                          className="w-10 h-10 border border-slate-200 rounded-lg cursor-pointer bg-white shrink-0"
                        />
                        <input 
                          type="text" 
                          value={sidebarSectionTextColor}
                          onChange={e => {
                            setSidebarSectionTextColor(e.target.value);
                            applySidebarPreview('sidebar-section-text', e.target.value);
                          }}
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs font-mono font-bold focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Background Menu Aktif</label>
                      <div className="flex gap-2 items-center">
                        <input 
                          type="color" 
                          value={sidebarActiveBgColor}
                          onChange={e => {
                            setSidebarActiveBgColor(e.target.value);
                            applySidebarPreview('sidebar-active-bg', e.target.value);
                          }}
                          className="w-10 h-10 border border-slate-200 rounded-lg cursor-pointer bg-white shrink-0"
                        />
                        <input 
                          type="text" 
                          value={sidebarActiveBgColor}
                          onChange={e => {
                            setSidebarActiveBgColor(e.target.value);
                            applySidebarPreview('sidebar-active-bg', e.target.value);
                          }}
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs font-mono font-bold focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Teks Menu Aktif</label>
                      <div className="flex gap-2 items-center">
                        <input 
                          type="color" 
                          value={sidebarActiveTextColor}
                          onChange={e => {
                            setSidebarActiveTextColor(e.target.value);
                            applySidebarPreview('sidebar-active-text', e.target.value);
                          }}
                          className="w-10 h-10 border border-slate-200 rounded-lg cursor-pointer bg-white shrink-0"
                        />
                        <input 
                          type="text" 
                          value={sidebarActiveTextColor}
                          onChange={e => {
                            setSidebarActiveTextColor(e.target.value);
                            applySidebarPreview('sidebar-active-text', e.target.value);
                          }}
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs font-mono font-bold focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-1">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Garis Tepi & Pemisah (Borders)</label>
                      <div className="flex gap-2 items-center">
                        <input 
                          type="color" 
                          value={sidebarBorderColor}
                          onChange={e => {
                            setSidebarBorderColor(e.target.value);
                            applySidebarPreview('sidebar-border', e.target.value);
                          }}
                          className="w-10 h-10 border border-slate-200 rounded-lg cursor-pointer bg-white shrink-0"
                        />
                        <input 
                          type="text" 
                          value={sidebarBorderColor}
                          onChange={e => {
                            setSidebarBorderColor(e.target.value);
                            applySidebarPreview('sidebar-border', e.target.value);
                          }}
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs font-mono font-bold focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Teks Judul Brand / Logo</label>
                      <div className="flex gap-2 items-center">
                        <input 
                          type="color" 
                          value={sidebarLogoTextColor}
                          onChange={e => {
                            setSidebarLogoTextColor(e.target.value);
                            applySidebarPreview('sidebar-logo-text', e.target.value);
                          }}
                          className="w-10 h-10 border border-slate-200 rounded-lg cursor-pointer bg-white shrink-0"
                        />
                        <input 
                          type="text" 
                          value={sidebarLogoTextColor}
                          onChange={e => {
                            setSidebarLogoTextColor(e.target.value);
                            applySidebarPreview('sidebar-logo-text', e.target.value);
                          }}
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs font-mono font-bold focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-1">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Background Hover Menu</label>
                      <div className="flex gap-2 items-center">
                        <input 
                          type="color" 
                          value={sidebarHoverBgColor}
                          onChange={e => {
                            setSidebarHoverBgColor(e.target.value);
                            applySidebarPreview('sidebar-hover-bg', e.target.value);
                          }}
                          className="w-10 h-10 border border-slate-200 rounded-lg cursor-pointer bg-white shrink-0"
                        />
                        <input 
                          type="text" 
                          value={sidebarHoverBgColor}
                          onChange={e => {
                            setSidebarHoverBgColor(e.target.value);
                            applySidebarPreview('sidebar-hover-bg', e.target.value);
                          }}
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs font-mono font-bold focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Teks Hover Menu</label>
                      <div className="flex gap-2 items-center">
                        <input 
                          type="color" 
                          value={sidebarHoverTextColor}
                          onChange={e => {
                            setSidebarHoverTextColor(e.target.value);
                            applySidebarPreview('sidebar-hover-text', e.target.value);
                          }}
                          className="w-10 h-10 border border-slate-200 rounded-lg cursor-pointer bg-white shrink-0"
                        />
                        <input 
                          type="text" 
                          value={sidebarHoverTextColor}
                          onChange={e => {
                            setSidebarHoverTextColor(e.target.value);
                            applySidebarPreview('sidebar-hover-text', e.target.value);
                          }}
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs font-mono font-bold focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Cepat Atur Preset Sidebar */}
                  <div className="pt-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Quick Themes: Preset Sidebar</label>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setSidebarBgColor('#ffffff');
                          setSidebarTextColor('#64748b');
                          setSidebarActiveBgColor('#f0f2fe');
                          setSidebarActiveTextColor('#4f46e5');
                          setSidebarBorderColor('#f1f5f9');
                          setSidebarHoverBgColor('#f8fafc');
                          setSidebarHoverTextColor('#0f172a');
                          setSidebarLogoTextColor('#0f172a');
                          setSidebarSectionTextColor('#94a3b8');

                          applySidebarPreview('sidebar-bg', '#ffffff');
                          applySidebarPreview('sidebar-text', '#64748b');
                          applySidebarPreview('sidebar-active-bg', '#f0f2fe');
                          applySidebarPreview('sidebar-active-text', '#4f46e5');
                          applySidebarPreview('sidebar-border', '#f1f5f9');
                          applySidebarPreview('sidebar-hover-bg', '#f8fafc');
                          applySidebarPreview('sidebar-hover-text', '#0f172a');
                          applySidebarPreview('sidebar-logo-text', '#0f172a');
                          applySidebarPreview('sidebar-section-text', '#94a3b8');
                        }}
                        className="px-4 py-2 text-xs bg-white text-slate-700 border border-slate-200 rounded-xl font-bold hover:bg-slate-50"
                      >
                        Sidebar Terang (Default)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSidebarBgColor('#0f172a');
                          setSidebarTextColor('#94a3b8');
                          setSidebarActiveBgColor('#1e293b');
                          setSidebarActiveTextColor('#ffffff');
                          setSidebarBorderColor('#1e293b');
                          setSidebarHoverBgColor('#1e293b');
                          setSidebarHoverTextColor('#f8fafc');
                          setSidebarLogoTextColor('#ffffff');
                          setSidebarSectionTextColor('#64748b');

                          applySidebarPreview('sidebar-bg', '#0f172a');
                          applySidebarPreview('sidebar-text', '#94a3b8');
                          applySidebarPreview('sidebar-active-bg', '#1e293b');
                          applySidebarPreview('sidebar-active-text', '#ffffff');
                          applySidebarPreview('sidebar-border', '#1e293b');
                          applySidebarPreview('sidebar-hover-bg', '#1e293b');
                          applySidebarPreview('sidebar-hover-text', '#f8fafc');
                          applySidebarPreview('sidebar-logo-text', '#ffffff');
                          applySidebarPreview('sidebar-section-text', '#64748b');
                        }}
                        className="px-4 py-2 text-xs bg-slate-900 text-white border border-slate-800 rounded-xl font-bold hover:bg-slate-800"
                      >
                        Sidebar Gelap (Dark Mode)
                      </button>
                    </div>
                  </div>
                </div>

                {/* Receipt Footer */}
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Footer Struk Pembelian (Receipt)</label>
                  <textarea 
                    value={receiptFooter}
                    onChange={e => setReceiptFooter(e.target.value)}
                    placeholder="Kalimat penutup di struk struk kasir..."
                    rows={3}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium resize-none"
                  />
                </div>
              </motion.div>
            )}

            {/* TAB 2: SENSOR & IOT CALIBRATION */}
            {activeTab === 'sensor' && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="bg-white border border-slate-100 rounded-3xl p-8 space-y-8 shadow-premium">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 font-extrabold">Kalibrasi Sensor Hand Gesture</h3>
                    <p className="text-xs text-slate-400 font-medium">Atur area jangkauan aman dan durasi gesture penahan klik sensor APDS9960.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    
                    {/* Active Zone Controller */}
                    <div className="space-y-6 relative overflow-hidden group">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                          <Target className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs uppercase font-extrabold tracking-wider text-slate-500">Jarak Deteksi Aman</h4>
                            <Tooltip.Root>
                              <Tooltip.Trigger asChild>
                                <button className="text-slate-300 hover:text-indigo-600 transition-colors">
                                  <HelpCircle className="w-3.5 h-3.5" />
                                </button>
                              </Tooltip.Trigger>
                              <Tooltip.Portal>
                                <Tooltip.Content
                                  className="bg-slate-900 text-white p-3 rounded-xl text-[10px] max-w-xs shadow-xl z-50 animate-in zoom-in-95 duration-200 font-semibold"
                                  sideOffset={5}
                                >
                                  Membatasi trigger gesture hanya jika tangan berada pada rentang jarak ini untuk mencegah "Ghost Clicks" dari pejalan kaki.
                                  <Tooltip.Arrow className="fill-slate-900" />
                                </Tooltip.Content>
                              </Tooltip.Portal>
                            </Tooltip.Root>
                          </div>
                          <p className="text-[11px] text-slate-400 font-medium">Jarak maksimal sensor APDS9960.</p>
                        </div>
                      </div>

                      <div className="space-y-12">
                        <div className="relative h-32 bg-slate-50 rounded-2xl border border-slate-100/50 flex items-end justify-center pb-4 overflow-hidden">
                          {/* Visual Gauge */}
                          <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
                            <div className="w-[80%] h-[1px] bg-slate-400 relative">
                              {[40, 50, 60, 70, 80].map(val => (
                                <div key={val} className="absolute top-0 h-2.5 w-[1px] bg-slate-600" style={{ left: `${(val - 40) * 2.5}%` }} />
                              ))}
                            </div>
                          </div>
                          
                          <motion.div 
                            animate={{ height: `${(activeZone[0] - 40) * 2.2 + 15}%` }}
                            className="w-20 bg-indigo-600/10 border-t-2 border-indigo-600 shadow-[0_0_15px_rgba(79,70,229,0.15)] relative flex items-center justify-center"
                          >
                            <div className="absolute -top-7 text-indigo-600 font-mono font-black text-xs">
                              {activeZone[0]}cm
                            </div>
                          </motion.div>
                          <div className="absolute bottom-2 text-[8px] uppercase tracking-widest text-slate-400 font-black">
                            Zona Aman Deteksi
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="flex justify-between text-xs font-bold">
                            <span className="text-slate-400 uppercase tracking-widest">Jarak Kalibrasi</span>
                            <span className="font-mono text-indigo-600">{activeZone[0]}cm</span>
                          </div>
                          <Slider.Root
                            className="relative flex items-center select-none touch-none w-full h-5 cursor-pointer"
                            value={activeZone}
                            onValueChange={setActiveZone}
                            max={80}
                            min={40}
                            step={1}
                          >
                            <Slider.Track className="bg-slate-100 relative grow rounded-full h-[6px]">
                              <Slider.Range className="absolute bg-indigo-600 rounded-full h-full" />
                            </Slider.Track>
                            <Slider.Thumb
                              className="block w-4.5 h-4.5 bg-white border-2 border-indigo-600 rounded-full focus:outline-none shadow-md cursor-pointer transition-transform hover:scale-110"
                              aria-label="Active Zone"
                            />
                          </Slider.Root>
                          <div className="flex justify-between text-[9px] text-slate-400 font-bold uppercase tracking-tighter">
                            <span>40cm (Sempit)</span>
                            <span>80cm (Lebar)</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Dwell Time Controller */}
                    <div className="space-y-6 relative overflow-hidden group">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                          <MousePointer2 className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs uppercase font-extrabold tracking-wider text-slate-500">Hold Confirm (Dwell)</h4>
                            <Tooltip.Root>
                              <Tooltip.Trigger asChild>
                                <button className="text-slate-300 hover:text-indigo-600 transition-colors">
                                  <HelpCircle className="w-3.5 h-3.5" />
                                </button>
                              </Tooltip.Trigger>
                              <Tooltip.Portal>
                                <Tooltip.Content
                                  className="bg-slate-900 text-white p-3 rounded-xl text-[10px] max-w-xs shadow-xl z-50 animate-in zoom-in-95 duration-200 font-semibold"
                                  sideOffset={5}
                                >
                                  Durasi tangan user harus diam di satu tempat (Dwell) untuk memicu trigger klik pada menu kiosk.
                                  <Tooltip.Arrow className="fill-slate-900" />
                                </Tooltip.Content>
                              </Tooltip.Portal>
                            </Tooltip.Root>
                          </div>
                          <p className="text-[11px] text-slate-400 font-medium">Waktu konfirmasi klik.</p>
                        </div>
                      </div>

                      <div className="space-y-12">
                        <div className="relative h-32 flex items-center justify-center bg-slate-50 rounded-2xl border border-slate-100/50">
                          <div className="relative w-20 h-20">
                            <svg className="w-full h-full -rotate-90">
                              <circle
                                cx="40"
                                cy="40"
                                r="32"
                                fill="transparent"
                                stroke="currentColor"
                                strokeWidth="3"
                                className="text-slate-100"
                              />
                              <motion.circle
                                cx="40"
                                cy="40"
                                r="32"
                                fill="transparent"
                                stroke="currentColor"
                                strokeWidth="3"
                                strokeDasharray="201"
                                animate={{ strokeDashoffset: 201 - (201 * dwellTime[0]) / 3 }}
                                className="text-indigo-600"
                              />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
                              <span className="text-base font-black font-mono text-slate-900">{dwellTime[0]}s</span>
                              <span className="text-[8px] uppercase text-slate-400 font-black mt-0.5">Tahan</span>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="flex justify-between text-xs font-bold">
                            <span className="text-slate-400 uppercase tracking-widest">Durasi Klik</span>
                            <span className="font-mono text-indigo-600">{dwellTime[0]}s</span>
                          </div>
                          <Slider.Root
                            className="relative flex items-center select-none touch-none w-full h-5 cursor-pointer"
                            value={dwellTime}
                            onValueChange={setDwellTime}
                            max={3.0}
                            min={0.5}
                            step={0.1}
                          >
                            <Slider.Track className="bg-slate-100 relative grow rounded-full h-[6px]">
                              <Slider.Range className="absolute bg-indigo-600 rounded-full h-full" />
                            </Slider.Track>
                            <Slider.Thumb
                              className="block w-4.5 h-4.5 bg-white border-2 border-indigo-600 rounded-full focus:outline-none shadow-md cursor-pointer transition-transform hover:scale-110"
                              aria-label="Dwell Time"
                            />
                          </Slider.Root>
                          <div className="flex justify-between text-[9px] text-slate-400 font-bold uppercase tracking-tighter">
                            <span>0.5 Detik (Instan)</span>
                            <span>3.0 Detik (Lambat)</span>
                          </div>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>

                {/* LIVE SENSOR SIMULATOR PANEL */}
                <div className="bg-slate-900 border border-slate-950 rounded-3xl p-8 text-white relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                    <Activity className="w-40 h-40" />
                  </div>

                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6 mb-6">
                    <div>
                      <h3 className="text-base font-black uppercase tracking-wider text-indigo-400 flex items-center gap-2">
                        <Activity className="w-5 h-5 animate-pulse text-indigo-400" />
                        Live Sensor Testing Simulator
                      </h3>
                      <p className="text-xs text-slate-400 font-medium mt-0.5">Simulasikan pembacaan jarak tangan hardware APDS9960.</p>
                    </div>
                    
                    <button
                      onClick={() => setIsSimulating(!isSimulating)}
                      className={cn(
                        "flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-bold transition-all shadow-md shrink-0 uppercase tracking-widest",
                        isSimulating 
                          ? "bg-rose-600 hover:bg-rose-700 text-white" 
                          : "bg-indigo-600 hover:bg-indigo-700 text-white"
                      )}
                    >
                      {isSimulating ? <Square size={14} /> : <Play size={14} />}
                      {isSimulating ? 'Stop Simulasi' : 'Mulai Tes Sensor'}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-slate-950/50 border border-slate-800 p-5 rounded-2xl flex flex-col items-center justify-center text-center">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Jarak Tangan Terbaca</p>
                      <p className="text-4xl font-mono font-black text-white mt-2 mb-1">
                        {isSimulating ? `${simulatedDistance} cm` : '--'}
                      </p>
                      <span className={cn(
                        "px-2.5 py-0.5 text-[9px] font-extrabold uppercase rounded-full border",
                        !isSimulating 
                          ? "bg-slate-800 text-slate-400 border-slate-700" 
                          : simulatedDistance <= activeZone[0]
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                            : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                      )}>
                        {!isSimulating ? 'Standby' : simulatedDistance <= activeZone[0] ? 'Safe Zone (Hit)' : 'Terlalu Jauh'}
                      </span>
                    </div>

                    <div className="bg-slate-950/50 border border-slate-800 p-5 rounded-2xl flex flex-col items-center justify-center">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3 text-center">Progres Confirm (Hold)</p>
                      
                      <div className="relative w-16 h-16">
                        <svg className="w-full h-full -rotate-90">
                          <circle
                            cx="32"
                            cy="32"
                            r="26"
                            fill="transparent"
                            stroke="#1e293b"
                            strokeWidth="4"
                          />
                          <circle
                            cx="32"
                            cy="32"
                            r="26"
                            fill="transparent"
                            stroke="#4f46e5"
                            strokeWidth="4"
                            strokeDasharray="163.3"
                            strokeDashoffset={163.3 - (163.3 * simulatedProgress) / 100}
                            className="transition-all duration-75"
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center text-xs font-mono font-black">
                          {simulatedProgress}%
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-950/50 border border-slate-800 p-5 rounded-2xl flex flex-col justify-center text-xs space-y-2 text-slate-300 font-medium">
                      <p className="font-bold text-white border-b border-slate-800 pb-1 mb-1 uppercase tracking-widest text-[9px]">Status Alur</p>
                      <div className="flex justify-between">
                        <span>Jangkauan Kalibrasi:</span>
                        <span className="font-mono text-indigo-400 font-bold">{activeZone[0]} cm</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Treshold Konfirmasi:</span>
                        <span className="font-mono text-indigo-400 font-bold">{dwellTime[0]} detik</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Pemicu Klik Kiosk:</span>
                        <span className={cn(
                          "font-bold uppercase text-[9px]",
                          simulatedProgress >= 100 ? "text-emerald-400" : "text-slate-400"
                        )}>
                          {simulatedProgress >= 100 ? "✓ CLICK TRIGGERED" : "Menunggu..."}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB 3: SYSTEM CONFIGURATION */}
            {activeTab === 'system' && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white border border-slate-100 rounded-3xl p-8 space-y-6 shadow-premium"
              >
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Sistem & Performa Kiosk</h3>
                  <p className="text-xs text-slate-400 font-medium">Konfigurasi internal, mode interaksi layar utama, dan pemeliharaan.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-b border-slate-50 pb-6">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Layar Kiosk Idle Timeout (detik)</label>
                    <input 
                      type="number" 
                      min={10}
                      max={600}
                      value={kioskIdleTimeout}
                      onChange={e => setKioskIdleTimeout(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Metode Interaksi Layar</label>
                    <div className="flex gap-2 p-1 bg-slate-100 rounded-xl border border-slate-200">
                      {[
                        { id: 'gesture', label: 'Air Gesture' },
                        { id: 'touch', label: 'Layar Sentuh' },
                        { id: 'hybrid', label: 'Hybrid' }
                      ].map(mode => (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() => setKioskMode(mode.id)}
                          className={cn(
                            'flex-1 text-[10px] font-black uppercase tracking-wider py-2.5 rounded-lg transition-all',
                            kioskMode === mode.id
                              ? 'bg-white text-indigo-600 shadow-sm'
                              : 'text-slate-400 hover:text-slate-700'
                          )}
                        >
                          {mode.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Maintenance Toggle */}
                <div className="p-6 bg-slate-50 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 border border-slate-100">
                  <div className="flex gap-3">
                    <div className="p-3 bg-white border border-slate-100 rounded-xl text-amber-500 shrink-0 h-fit">
                      <AlertTriangle size={20} />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Mode Pemeliharaan (Maintenance Mode)</h4>
                      <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                        Menutup layar pemesanan kiosk dan menampilkan pesan "Dalam Pemeliharaan" kepada pelanggan umum.
                      </p>
                    </div>
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => setMaintenanceMode(!maintenanceMode)}
                    className={cn(
                      "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none shrink-0",
                      maintenanceMode ? "bg-amber-500" : "bg-slate-200"
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                        maintenanceMode ? "translate-x-6" : "translate-x-1"
                      )}
                    />
                  </button>
                </div>
              </motion.div>
            )}

          </div>

          {/* Right Column: Visual Info Card */}
          <div className="space-y-6">
            <div className="bg-slate-50 rounded-3xl border border-slate-100 p-6 flex gap-4">
              <Info className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
              <div className="text-xs font-medium text-slate-600 space-y-1.5 leading-relaxed">
                <p className="font-extrabold text-slate-800 uppercase tracking-wider">Catatan Konfigurasi</p>
                <p>
                  Perubahan nama brand, subtitle, dan logo akan langsung mengubah estetika identitas visual pada **Sidebar Utama** dan **Invoice Pembelian**.
                </p>
                <p>
                  Direkomendasikan melakukan pengetesan menggunakan **Live Sensor Simulator** di tab Kalibrasi untuk memastikan jarak deteksi aman tangan dan responsivitas klik (*dwell time*) nyaman digunakan oleh pelanggan fisik.
                </p>
              </div>
            </div>

            {/* Active Profile Status Preview Card */}
            <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-premium space-y-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-50 pb-2">Status Server IoT & Kiosk</p>
              
              <div className="space-y-3.5 text-xs font-bold text-slate-600">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Status Server:</span>
                  <span className="flex items-center gap-1 text-emerald-600">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Online (Port 3000)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Modul Sensor:</span>
                  <span className="text-slate-700">APDS9960 (Terhubung)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Mode Layar:</span>
                  <span className="text-indigo-600 font-extrabold capitalize">{kioskMode} Mode</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Idle Timeout:</span>
                  <span className="text-slate-700 font-mono">{kioskIdleTimeout} Detik</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Pemeliharaan:</span>
                  <span className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded font-black uppercase",
                    maintenanceMode ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-400"
                  )}>
                    {maintenanceMode ? "Aktif" : "Non-Aktif"}
                  </span>
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>
    </Tooltip.Provider>
  );
}
