const fs = require('fs');
const path = require('path');
const dir = 'src/components';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx'));
files.forEach(f => {
  const filePath = path.join(dir, f);
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  // Fix table headers:
  if (content.includes('bg-slate-50/50') && content.includes('<thead')) {
    content = content.replace(/className="bg-slate-50\/50/g, 'className="bg-slate-50 dark:bg-slate-800/50');
    changed = true;
  }
  
  // Fix Table Header background everywhere in table headers 
  // Let's just be specific about the classes we want to fix:
  // e.g. <tr className="bg-slate-50/50 ..."
  const trRegex = /<tr[^>]*bg-slate-50\/50[^>]*>/g;
  if (trRegex.test(content)) {
    content = content.replace(trRegex, match => match.replace('bg-slate-50/50', 'bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-slate-100 dark:border-slate-800'));
    changed = true;
  }
  // also fix table header bg-slate-200
  const trRegex2 = /<tr[^>]*bg-slate-200[^>]*>/g;
  if (trRegex2.test(content)) {
    content = content.replace(trRegex2, match => match.replace('bg-slate-200', 'bg-slate-200 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-slate-100 dark:border-slate-800'));
    changed = true;
  }

  // Remove colored shadows in dark mode:
  // Find all classes like shadow-indigo-200, shadow-purple-500, etc.
  // Add dark:shadow-none right after it if not already present
  const regex = /shadow-[a-z]+-\d{1,3}(?:\/\d+)?(?!\s+dark:shadow-none)/g;
  if (regex.test(content)) {
    content = content.replace(regex, match => match + ' dark:shadow-none');
    changed = true;
  }

  // Find colored shadows defined dynamically with arbitrary values, though they usually use standard classes.
  // Wait, the regex shadow-[a-z]+-\d{1,3} matches exactly things like `shadow-indigo-200`
  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Updated ' + f);
  }
});
console.log('Done.');
