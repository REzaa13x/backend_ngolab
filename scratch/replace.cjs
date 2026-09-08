const fs = require('fs');
const path = 'src/components/IoTConfig.tsx';
let content = fs.readFileSync(path, 'utf8');

const regex = /<div className="flex gap-2 items-center">\s*<input\s+type="color"\s+value=\{([^}]+)\}\s+onChange=\{([\s\S]*?)\}\s+className="w-10 h-10 border border-slate-200 rounded-lg cursor-pointer bg-white shrink-0"\s*\/>\s*<input\s+type="text"\s+value=\{([^}]+)\}\s+onChange=\{([\s\S]*?)\}\s+className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs font-mono font-bold focus:outline-none"\s*\/>\s*<\/div>/g;

content = content.replace(regex, (match, val1, onChange1, val2, onChange2) => {
  return `<div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-300 transition-all shadow-sm hover:border-slate-300">
                        <div className="relative flex items-center justify-center shrink-0" title="Pilih Warna">
                          <input 
                            type="color" 
                            value={${val1}}
                            onChange={${onChange1}}
                            className="w-7 h-7 cursor-pointer opacity-0 absolute inset-0 z-10"
                          />
                          <div 
                            className="w-7 h-7 rounded-full border border-slate-300 shadow-inner" 
                            style={{ backgroundColor: ${val1} }} 
                          />
                        </div>
                        <input 
                          type="text" 
                          value={${val1}}
                          onChange={${onChange1}}
                          className="w-full bg-transparent text-xs font-mono font-bold text-slate-700 focus:outline-none uppercase"
                        />
                      </div>`;
});

fs.writeFileSync(path, content);
console.log('Replaced successfully');
