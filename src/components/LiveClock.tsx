import React, { useEffect, useState } from 'react';
import { formatClock, startClock } from '../lib/liveClock';

export default function LiveClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const refresh = () => setNow(new Date());
    const stop = startClock(setNow, {
      now: () => new Date(),
      setInterval: (callback, ms) => window.setInterval(callback, ms),
      clearInterval: id => window.clearInterval(id),
    });
    document.addEventListener('visibilitychange', refresh);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  const { date, time } = formatClock(now);
  return (
    <div className="hidden lg:block text-right whitespace-nowrap" aria-label="Waktu Indonesia Barat">
      <p className="text-xs font-bold text-slate-900 tabular-nums">{time} WIB</p>
      <p className="text-[10px] font-medium text-slate-500">{date}</p>
    </div>
  );
}
