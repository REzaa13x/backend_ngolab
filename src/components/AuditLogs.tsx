import React, { useEffect, useState } from 'react';
import { 
  ShieldCheck, 
  User, 
  Zap, 
  Clock, 
  Terminal, 
  Search,
  Filter,
  Download,
  AlertTriangle,
  Info,
  CheckCircle2
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '@/src/lib/utils';

interface AuditLog {
  id: number;
  user: string;
  action: string;
  target: string;
  timestamp: string;
  status: 'success' | 'warning' | 'info';
  ip: string;
}

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetch('/api/audit-logs')
      .then(res => res.json())
      .then(data => {
        setLogs(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch audit logs:", err);
        setLoading(false);
      });
  }, []);

  const filteredLogs = logs.filter(log => 
    log.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.target.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-3">
            <ShieldCheck className="text-indigo-600" size={28} />
            Log Keamanan & Audit
          </h2>
          <p className="text-sm text-slate-500 font-medium tracking-tight">Rekam jejak aktivitas sistem dan integritas data (RBAC Implementation Compliance).</p>
        </div>
        <div className="flex items-center gap-3">
           <div className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border border-emerald-100">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Monitoring Aktif
           </div>
           <button className="p-2.5 bg-white border border-slate-100 rounded-xl text-slate-400 hover:text-indigo-600 transition-all shadow-sm">
              <Download size={18} />
           </button>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl overflow-hidden">
        <div className="p-6 border-b border-slate-50 bg-slate-50/30 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Cari user, aktivitas, atau target..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
            />
          </div>
          <button className="px-6 py-2.5 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-black transition-all">
            <Filter size={14} /> Filter Lanjut
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-50">
                <th className="px-8 py-5">Waktu</th>
                <th className="px-8 py-5">Pengguna / Aktor</th>
                <th className="px-8 py-5">Aktivitas</th>
                <th className="px-8 py-5">Target Objek</th>
                <th className="px-8 py-5">Status</th>
                <th className="px-8 py-5 text-right">Alamat IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center">
                    <div className="inline-flex items-center gap-3 px-6 py-3 bg-indigo-50 text-indigo-600 rounded-full animate-pulse text-[10px] font-black uppercase tracking-widest">
                       <Zap size={14} className="animate-spin" /> Mengakses Brankas Log...
                    </div>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center text-slate-400 font-bold italic text-sm">
                    Tidak ada log aktivitas yang ditemukan.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3">
                        <Clock size={14} className="text-slate-300" />
                        <span className="text-xs font-medium text-slate-600">
                          {new Date(log.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                          <User size={14} />
                        </div>
                        <span className="text-sm font-black text-slate-900">{log.user}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-sm font-bold text-slate-600">
                      {log.action}
                    </td>
                    <td className="px-8 py-5">
                      <code className="text-[10px] font-mono bg-indigo-50 text-indigo-600 px-2 py-1 rounded">
                        {log.target}
                      </code>
                    </td>
                    <td className="px-8 py-5">
                      <span className={cn(
                        "px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest inline-flex items-center gap-1.5 border",
                        log.status === 'success' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                        log.status === 'warning' ? "bg-rose-50 text-rose-600 border-rose-100" :
                        "bg-indigo-50 text-indigo-600 border-indigo-100"
                      )}>
                        {log.status === 'success' && <CheckCircle2 size={10} />}
                        {log.status === 'warning' && <AlertTriangle size={10} />}
                        {log.status === 'info' && <Info size={10} />}
                        {log.status}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-right font-mono text-[10px] text-slate-400">
                      {log.ip}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        <div className="p-6 bg-slate-50/30 border-t border-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal size={14} className="text-slate-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">System Kernel v2.4.0</span>
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Total {filteredLogs.length} Aktivitas Terekam
          </p>
        </div>
      </div>
    </div>
  );
}
