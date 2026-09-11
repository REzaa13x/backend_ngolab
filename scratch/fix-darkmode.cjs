const fs = require('fs');
const path = require('path');

const dir = 'src/components';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx'));

files.forEach(file => {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // Fix button shadows
  content = content.replace(/(shadow-(slate|indigo|rose|emerald|blue|gray)-\d{3})(?!\/)(?!\s*dark:shadow-none)/g, '$1 dark:shadow-none');

  // Fix text colors (headings, paragraphs)
  content = content.replace(/text-slate-900(?!\s*dark:text-)/g, 'text-slate-900 dark:text-white');
  content = content.replace(/text-slate-800(?!\s*dark:text-)/g, 'text-slate-800 dark:text-slate-100');
  content = content.replace(/text-slate-700(?!\s*dark:text-)/g, 'text-slate-700 dark:text-slate-200');
  content = content.replace(/text-slate-600(?!\s*dark:text-)/g, 'text-slate-600 dark:text-slate-300');
  content = content.replace(/text-slate-500(?!\s*dark:text-)/g, 'text-slate-500 dark:text-slate-400');

  // Background panels
  content = content.replace(/bg-white border border-slate-100(?!\s*dark:)/g, 'bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700');
  content = content.replace(/bg-slate-50 border border-slate-100(?!\s*dark:)/g, 'bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700');
  
  // Tab containers
  content = content.replace(/bg-white\/50 backdrop-blur-sm border border-slate-100(?!\s*dark:)/g, 'bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-slate-100 dark:border-slate-700');

  // Active tabs
  content = content.replace(/bg-white text-indigo-600 shadow-sm(?!\s*dark:)/g, 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm');
  
  // Hover effects on cards
  content = content.replace(/hover:bg-slate-50(?!\s*dark:)/g, 'hover:bg-slate-50 dark:hover:bg-slate-700/50');
  
  // Light tint backgrounds (indigo-50, rose-50, emerald-50)
  content = content.replace(/bg-indigo-50(?!\s*dark:)/g, 'bg-indigo-50 dark:bg-indigo-500/10');
  content = content.replace(/bg-rose-50(?!\s*dark:)/g, 'bg-rose-50 dark:bg-rose-500/10');
  content = content.replace(/bg-emerald-50(?!\s*dark:)/g, 'bg-emerald-50 dark:bg-emerald-500/10');
  content = content.replace(/bg-amber-50(?!\s*dark:)/g, 'bg-amber-50 dark:bg-amber-500/10');
  
  // Light tint borders
  content = content.replace(/border-indigo-100(?!\s*dark:)/g, 'border-indigo-100 dark:border-indigo-500/20');
  content = content.replace(/border-rose-100(?!\s*dark:)/g, 'border-rose-100 dark:border-rose-500/20');
  content = content.replace(/border-emerald-100(?!\s*dark:)/g, 'border-emerald-100 dark:border-emerald-500/20');
  content = content.replace(/border-amber-100(?!\s*dark:)/g, 'border-amber-100 dark:border-amber-500/20');

  if (content !== original) {
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${file}`);
  }
});
console.log('Done!');
