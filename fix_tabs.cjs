
const fs = require('fs');
const path = require('path');
const files = [
  'src/components/StaffManagement.tsx',
  'src/components/StockManagement.tsx',
  'src/components/IoTConfig.tsx'
];
files.forEach(filePath => {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  // Fix the container: bg-white/50
  if (content.includes('bg-white/50 backdrop-blur-sm border border-slate-100 p-1')) {
    content = content.replace(/bg-white\/50 backdrop-blur-sm border border-slate-100 p-1/g, 'bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-slate-100 dark:border-slate-800 p-1');
    changed = true;
  }

  // Fix active tab: bg-white text-indigo-600 shadow-sm
  if (content.includes('bg-white text-indigo-600 shadow-sm')) {
    content = content.replace(/bg-white text-indigo-600 shadow-sm/g, 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-orange-500 shadow-sm dark:shadow-none');
    changed = true;
  }

  // Fix inactive tab: text-slate-400 hover:text-slate-600
  if (content.includes('text-slate-400 hover:text-slate-600')) {
    content = content.replace(/text-slate-400 hover:text-slate-600/g, 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300');
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Fixed tabs in ' + filePath);
  }
});
console.log('Done.');

