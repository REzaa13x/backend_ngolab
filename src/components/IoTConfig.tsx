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
  Moon,
  BellRing,
  Trash2
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useSettings } from '../contexts/SettingsContext';
import { authFetch } from '../lib/authFetch';
import { playConfiguredKdsSound, unlockAudioContext } from '../lib/audioHelper';

type ActiveTabSettings = 'brand' | 'sensor' | 'system' | 'sound' | 'loyalty';

export default function IoTConfig() {
  const { settings, updateSettings, refreshSettings } = useSettings();
  const [activeTab, setActiveTab] = useState<ActiveTabSettings>('brand');
  
  // Local state initialized from SettingsContext
  const [brandName, setBrandName] = useState(settings.brand_name);
  const [brandSubtitle, setBrandSubtitle] = useState(settings.brand_subtitle);
  const [themeMode, setThemeMode] = useState(settings.theme_mode || 'light');
  const [receiptFooter, setReceiptFooter] = useState(settings.receipt_footer);
  
  const [activeZone, setActiveZone] = useState([parseInt(settings.active_zone) || 60]);
  const [dwellTime, setDwellTime] = useState([parseFloat(settings.dwell_time) || 1.5]);
  
  const [kioskIdleTimeout, setKioskIdleTimeout] = useState(settings.kiosk_idle_timeout);
  const [kioskMode, setKioskMode] = useState(settings.kiosk_mode);
  const [maintenanceMode, setMaintenanceMode] = useState(settings.maintenance_mode === '1');
  const [kdsSoundEnabled, setKdsSoundEnabled] = useState(settings.kds_sound_enabled !== '0');
  const [kdsSoundVolume, setKdsSoundVolume] = useState([Number(settings.kds_sound_volume || 100)]);
  const [uploadingSound, setUploadingSound] = useState<'new_order' | 'ready' | null>(null);
  const [coinRewardRate, setCoinRewardRate] = useState(settings.coin_reward_rate || '0.001');


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
    setThemeMode(settings.theme_mode || 'light');
    setReceiptFooter(settings.receipt_footer);
    setActiveZone([parseInt(settings.active_zone) || 60]);
    setDwellTime([parseFloat(settings.dwell_time) || 1.5]);
    setKioskIdleTimeout(settings.kiosk_idle_timeout);
    setKioskMode(settings.kiosk_mode);
    setMaintenanceMode(settings.maintenance_mode === '1');
    setKdsSoundEnabled(settings.kds_sound_enabled !== '0');
    setKdsSoundVolume([Number(settings.kds_sound_volume || 100)]);
    setCoinRewardRate(settings.coin_reward_rate || '0.001');
  }, [settings]);



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



  const applyThemeModePreview = (mode: string) => {
    if (mode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };


  const handleSoundUpload = async (type: 'new_order' | 'ready', file?: File) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('Ukuran suara maksimal 5 MB.'); return; }
    setUploadingSound(type);
    try {
      const formData = new FormData();
      formData.append('sound', file);
      formData.append('type', type);
      const response = await authFetch('/api/settings/upload-kds-sound', { method: 'POST', body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Upload suara gagal.');
      await refreshSettings();
      setSaveMessage(type === 'new_order' ? 'Suara pesanan masuk berhasil diunggah!' : 'Suara pesanan siap berhasil diunggah!');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error: any) {
      alert(error.message || 'Upload suara gagal.');
    } finally {
      setUploadingSound(null);
    }
  };

  const testKdsSound = async (type: 'new_order' | 'ready') => {
    await unlockAudioContext();
    await playConfiguredKdsSound(type, {
      ...settings,
      kds_sound_enabled: kdsSoundEnabled ? '1' : '0',
      kds_sound_volume: String(kdsSoundVolume[0])
    });
  };

  const resetKdsSound = async (type: 'new_order' | 'ready') => {
    const response = await authFetch(`/api/settings/kds-sound/${type}`, { method: 'DELETE' });
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      await refreshSettings();
      setSaveMessage(data.message || 'Suara dikembalikan ke bell bawaan.');
      setTimeout(() => setSaveMessage(''), 3000);
    } else {
      alert(data.message || 'Gagal mereset suara.');
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage('');

    try {
      // Save all settings
      const newSettings = {
        brand_name: brandName,
        brand_subtitle: brandSubtitle,
        brand_logo_url: settings.brand_logo_url,
        theme_color: settings.theme_color,
        theme_mode: themeMode,
        receipt_footer: receiptFooter,
        active_zone: activeZone[0].toString(),
        dwell_time: dwellTime[0].toString(),
        kiosk_idle_timeout: kioskIdleTimeout,
        kiosk_mode: kioskMode,
        maintenance_mode: maintenanceMode ? '1' : '0',
        kds_sound_enabled: kdsSoundEnabled ? '1' : '0',
        kds_sound_volume: String(kdsSoundVolume[0]),
        kds_new_order_sound_url: settings.kds_new_order_sound_url,
        kds_ready_sound_url: settings.kds_ready_sound_url,
        sidebar_bg_color: settings.sidebar_bg_color,
        sidebar_text_color: settings.sidebar_text_color,
        sidebar_active_bg_color: settings.sidebar_active_bg_color,
        sidebar_active_text_color: settings.sidebar_active_text_color,
        sidebar_border_color: settings.sidebar_border_color,
        sidebar_hover_bg_color: settings.sidebar_hover_bg_color,
        sidebar_hover_text_color: settings.sidebar_hover_text_color,
        sidebar_logo_text_color: settings.sidebar_logo_text_color,
        sidebar_section_text_color: settings.sidebar_section_text_color,
        coin_reward_rate: coinRewardRate
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
        brand_name: 'GeastEats',
        brand_subtitle: 'Admin Panel',
        brand_logo_url: '',
        active_zone: '60',
        dwell_time: '1.5',
        kiosk_idle_timeout: '60',
        kiosk_mode: 'gesture',
        receipt_footer: 'Terima kasih atas kunjungan Anda!',
        maintenance_mode: '0',
        theme_mode: 'light',
        kds_sound_enabled: '1',
        kds_sound_volume: '100',
        kds_new_order_sound_url: '',
        kds_ready_sound_url: '',
        coin_reward_rate: '0.001'
      };

      const success = await updateSettings(defaults);
      if (success) {
        setBrandName(defaults.brand_name);
        setBrandSubtitle(defaults.brand_subtitle);
        setThemeMode(defaults.theme_mode);
        setReceiptFooter(defaults.receipt_footer);
        setActiveZone([60]);
        setDwellTime([1.5]);
        setKioskIdleTimeout(defaults.kiosk_idle_timeout);
        setKioskMode(defaults.kiosk_mode);
        setMaintenanceMode(false);
        setKdsSoundEnabled(true);
        setKdsSoundVolume([100]);
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
        <div className="flex flex-wrap border-b border-slate-100 gap-1 p-1 bg-slate-50 rounded-2xl w-fit border">
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
          <button
            onClick={() => setActiveTab('sound')}
            className={cn(
              "flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
              activeTab === 'sound'
                ? "bg-white text-indigo-600 shadow-sm border border-slate-100"
                : "text-slate-400 hover:text-slate-700"
            )}
          >
            <BellRing size={16} />
            Suara KDS
          </button>
          <button
            onClick={() => setActiveTab('loyalty')}
            className={cn(
              "flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
              activeTab === 'loyalty'
                ? "bg-white text-indigo-600 shadow-sm border border-slate-100"
                : "text-slate-400 hover:text-slate-700"
            )}
          >
            <Target size={16} />
            Loyalty Program
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

            {/* KDS SOUND CONFIGURATION */}
            {activeTab === 'sound' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white border border-slate-100 rounded-3xl p-8 space-y-7 shadow-premium"
              >
                <div>
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2"><BellRing className="text-indigo-600"/> Suara Tampilan Dapur</h3>
                  <p className="text-xs text-slate-400 font-medium mt-1">Atur suara pesanan masuk dan pesanan siap. Format: MP3, WAV, OGG, M4A, atau WebM; maksimal 5 MB.</p>
                </div>

                <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <div><p className="font-bold text-slate-800">Aktifkan suara KDS</p><p className="text-xs text-slate-400">Perangkat dapur masih dapat dimute secara lokal.</p></div>
                  <button type="button" onClick={() => setKdsSoundEnabled(value => !value)} className={cn('w-14 h-8 rounded-full p-1 transition-colors', kdsSoundEnabled ? 'bg-emerald-500' : 'bg-slate-300')}><span className={cn('block w-6 h-6 rounded-full bg-white shadow transition-transform', kdsSoundEnabled && 'translate-x-6')} /></button>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-bold mb-2"><span className="text-slate-500">Volume suara</span><span className="text-indigo-600">{kdsSoundVolume[0]}%</span></div>
                  <input type="range" min="0" max="100" step="5" value={kdsSoundVolume[0]} onChange={event => setKdsSoundVolume([Number(event.target.value)])} className="w-full accent-indigo-600" />
                </div>

                {([
                  { type: 'new_order' as const, title: 'Pesanan Masuk', description: 'Diputar ketika pesanan lunas masuk ke antrean dapur.', url: settings.kds_new_order_sound_url },
                  { type: 'ready' as const, title: 'Pesanan Siap', description: 'Diputar ketika pesanan selesai dimasak dan siap diambil.', url: settings.kds_ready_sound_url }
                ]).map(sound => (
                  <div key={sound.type} className="p-5 rounded-2xl border border-slate-200 space-y-4">
                    <div className="flex items-start justify-between gap-4"><div><p className="font-bold text-slate-900">{sound.title}</p><p className="text-xs text-slate-400 mt-1">{sound.description}</p></div><span className={cn('px-2 py-1 rounded-full text-[10px] font-black', sound.url ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500')}>{sound.url ? 'KUSTOM' : 'BAWAAN'}</span></div>
                    {sound.url && <audio controls preload="metadata" src={sound.url} className="w-full h-10" />}
                    <div className="flex flex-wrap gap-2">
                      <label className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold cursor-pointer flex items-center gap-2"><UploadCloud size={15}/>{uploadingSound === sound.type ? 'Mengunggah...' : 'Upload Suara'}<input type="file" accept="audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/webm,.mp3,.wav,.ogg,.m4a,.webm" disabled={uploadingSound !== null} className="hidden" onChange={event => handleSoundUpload(sound.type, event.target.files?.[0])}/></label>
                      <button type="button" onClick={() => testKdsSound(sound.type)} className="px-4 py-2.5 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold flex items-center gap-2"><Play size={15}/> Tes Suara</button>
                      {sound.url && <button type="button" onClick={() => resetKdsSound(sound.type)} className="px-4 py-2.5 rounded-xl bg-rose-50 text-rose-600 text-xs font-bold flex items-center gap-2"><Trash2 size={15}/> Gunakan Bawaan</button>}
                    </div>
                  </div>
                ))}

                <div className="p-4 rounded-xl bg-amber-50 border border-amber-100 text-amber-800 text-xs leading-relaxed"><strong>Catatan browser:</strong> Setelah membuka Tampilan Dapur, klik satu kali tombol suara atau area halaman agar browser mengizinkan pemutaran otomatis.</div>
              </motion.div>
            )}

            {/* TAB: LOYALTY CONFIGURATION */}
            {activeTab === 'loyalty' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white border border-slate-100 rounded-3xl p-8 space-y-7 shadow-premium"
              >
                <div>
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2"><Target className="text-indigo-600"/> Program Loyalty & Poin</h3>
                  <p className="text-xs text-slate-400 font-medium mt-1">Konfigurasi pemberian poin koin otomatis setiap pelanggan bertransaksi di aplikasi.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Rate Poin (poin per Rp 1)</label>
                    <input 
                      type="number" 
                      step="0.001"
                      min="0"
                      max="0.1"
                      value={coinRewardRate}
                      onChange={e => setCoinRewardRate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-bold"
                    />
                    <p className="text-[10px] text-slate-500 mt-2">Rekomendasi: 0.001 = 1 poin setiap Rp 1.000. Contoh 0.005 = 5 poin setiap Rp 1.000 (0,5% nilai transaksi). Maksimal 0.1 untuk mencegah pemberian poin tidak sengaja terlalu besar.</p>
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
