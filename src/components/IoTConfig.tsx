import React, { useState } from 'react';
import * as Slider from '@radix-ui/react-slider';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Cpu, Info, Target, MousePointer2, RefreshCcw, HelpCircle } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { motion } from 'motion/react';

export default function IoTConfig() {
  const [activeZone, setActiveZone] = useState([60]);
  const [dwellTime, setDwellTime] = useState([1.5]);

  return (
    <Tooltip.Provider>
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Hardware/IoT Config</h1>
            <p className="text-muted-foreground">Calibrate sensors and gesture sensitivity for the kiosk.</p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-secondary rounded-lg text-sm font-medium hover:bg-secondary/80 transition-colors">
            <RefreshCcw className="w-4 h-4" />
            Reset to Default
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Active Zone Controller */}
          <div className="bg-card border border-border rounded-xl p-8 space-y-8 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Target className="w-24 h-24" />
            </div>
            
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <Target className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-[12px] uppercase tracking-[0.5px] text-muted-foreground font-semibold">Active Zone Filtering</h2>
                  <Tooltip.Root>
                    <Tooltip.Trigger asChild>
                      <button className="text-muted-foreground hover:text-primary transition-colors">
                        <HelpCircle className="w-3.5 h-3.5" />
                      </button>
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                      <Tooltip.Content
                        className="bg-card border border-border p-3 rounded-lg text-xs max-w-xs shadow-xl z-50 animate-in zoom-in-95 duration-200"
                        sideOffset={5}
                      >
                        Filters out movements outside the specified range to prevent accidental triggers from passersby.
                        <Tooltip.Arrow className="fill-border" />
                      </Tooltip.Content>
                    </Tooltip.Portal>
                  </Tooltip.Root>
                </div>
                <p className="text-sm text-muted-foreground">Set the detection range for hand gestures.</p>
              </div>
            </div>

            <div className="space-y-12">
              <div className="relative h-32 bg-background/50 rounded-lg border border-border/50 flex items-end justify-center pb-4 overflow-hidden">
                {/* Visual Gauge */}
                <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
                  <div className="w-[80%] h-[1px] bg-muted-foreground/30 relative">
                    {[40, 50, 60, 70, 80].map(val => (
                      <div key={val} className="absolute top-0 h-2 w-[1px] bg-muted-foreground/30" style={{ left: `${(val - 40) * 2.5}%` }} />
                    ))}
                  </div>
                </div>
                
                <motion.div 
                  animate={{ height: `${(activeZone[0] - 40) * 2 + 20}%` }}
                  className="w-24 bg-primary/20 border-t-2 border-primary shadow-[0_0_15px_rgba(0,242,255,0.2)] relative"
                >
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-primary font-mono font-bold">
                    {activeZone[0]}cm
                  </div>
                </motion.div>
                <div className="absolute bottom-2 text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                  Current Safe Zone
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between text-sm font-medium">
                  <span className="text-muted-foreground">Range (cm)</span>
                  <span className="font-mono text-primary">{activeZone[0]}cm</span>
                </div>
                <Slider.Root
                  className="relative flex items-center select-none touch-none w-full h-5"
                  value={activeZone}
                  onValueChange={setActiveZone}
                  max={80}
                  min={40}
                  step={1}
                >
                  <Slider.Track className="bg-input relative grow rounded-full h-[6px]">
                    <Slider.Range className="absolute bg-primary rounded-full h-full" />
                  </Slider.Track>
                  <Slider.Thumb
                    className="block w-3.5 h-3.5 bg-white rounded-full focus:outline-none shadow-[0_0_10px_rgba(0,242,255,0.4)] cursor-pointer"
                    aria-label="Active Zone"
                  />
                </Slider.Root>
                <div className="flex justify-between text-[10px] text-muted-foreground font-bold uppercase tracking-tighter">
                  <span>40cm</span>
                  <span>80cm</span>
                </div>
              </div>
            </div>
          </div>

          {/* Dwell Time Controller */}
          <div className="bg-card border border-border rounded-xl p-8 space-y-8 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <MousePointer2 className="w-24 h-24" />
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <MousePointer2 className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-[12px] uppercase tracking-[0.5px] text-muted-foreground font-semibold">Dwell Time Calibration</h2>
                  <Tooltip.Root>
                    <Tooltip.Trigger asChild>
                      <button className="text-muted-foreground hover:text-primary transition-colors">
                        <HelpCircle className="w-3.5 h-3.5" />
                      </button>
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                      <Tooltip.Content
                        className="bg-card border border-border p-3 rounded-lg text-xs max-w-xs shadow-xl z-50 animate-in zoom-in-95 duration-200"
                        sideOffset={5}
                      >
                        The duration a user must maintain a gesture to confirm a selection. Prevents "ghost clicks."
                        <Tooltip.Arrow className="fill-border" />
                      </Tooltip.Content>
                    </Tooltip.Portal>
                  </Tooltip.Root>
                </div>
                <p className="text-sm text-muted-foreground">Define click trigger duration.</p>
              </div>
            </div>

            <div className="space-y-12">
              <div className="relative h-32 flex items-center justify-center">
                <div className="relative w-24 h-24">
                  <svg className="w-full h-full -rotate-90">
                    <circle
                      cx="48"
                      cy="48"
                      r="40"
                      fill="transparent"
                      stroke="currentColor"
                      strokeWidth="4"
                      className="text-input"
                    />
                    <motion.circle
                      cx="48"
                      cy="48"
                      r="40"
                      fill="transparent"
                      stroke="currentColor"
                      strokeWidth="4"
                      strokeDasharray="251.2"
                      animate={{ strokeDashoffset: 251.2 - (251.2 * dwellTime[0]) / 3 }}
                      className="text-primary shadow-[0_0_15px_rgba(0,242,255,0.2)]"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold font-mono">{dwellTime[0]}s</span>
                    <span className="text-[10px] uppercase text-muted-foreground font-bold">Hold</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between text-sm font-medium">
                  <span className="text-muted-foreground">Duration (seconds)</span>
                  <span className="font-mono text-primary">{dwellTime[0]}s</span>
                </div>
                <Slider.Root
                  className="relative flex items-center select-none touch-none w-full h-5"
                  value={dwellTime}
                  onValueChange={setDwellTime}
                  max={3.0}
                  min={0.5}
                  step={0.1}
                >
                  <Slider.Track className="bg-input relative grow rounded-full h-[6px]">
                    <Slider.Range className="absolute bg-primary rounded-full h-full" />
                  </Slider.Track>
                  <Slider.Thumb
                    className="block w-3.5 h-3.5 bg-white rounded-full focus:outline-none shadow-[0_0_10px_rgba(0,242,255,0.4)] cursor-pointer"
                    aria-label="Dwell Time"
                  />
                </Slider.Root>
                <div className="flex justify-between text-[10px] text-muted-foreground font-bold uppercase tracking-tighter">
                  <span>0.5s</span>
                  <span>3.0s</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Technical Info */}
        <div className="bg-secondary/30 border border-border rounded-lg p-4 flex gap-4">
          <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold">Calibration Note</p>
            <p className="text-muted-foreground">
              Higher dwell times reduce accidental clicks but may feel less responsive. 
              The active zone should be set according to the physical kiosk placement to avoid detecting background movement.
            </p>
          </div>
        </div>
      </div>
    </Tooltip.Provider>
  );
}
