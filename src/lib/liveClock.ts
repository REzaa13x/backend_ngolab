const dateFormatter = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'full' });
const timeFormatter = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });

export function formatClock(value: Date) {
  return { date: dateFormatter.format(value), time: timeFormatter.format(value) };
}

interface ClockScheduler {
  now: () => Date;
  setInterval: (callback: () => void, ms: number) => number;
  clearInterval: (id: number) => void;
}

export function startClock(update: (value: Date) => void, scheduler: ClockScheduler): () => void {
  const tick = () => update(scheduler.now());
  tick();
  const timer = scheduler.setInterval(tick, 1000);
  return () => scheduler.clearInterval(timer);
}
