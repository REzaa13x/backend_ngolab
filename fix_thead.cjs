const fs = require('fs');
const path = require('path');
const dir = 'src/components';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx'));
files.forEach(f => {
  const filePath = path.join(dir, f);
  let content = fs.readFileSync(filePath, 'utf8');

  const theadRegex = /<thead[\s\S]*?<\/thead>/g;
  content = content.replace(theadRegex, theadMatch => {
    // Find the <tr> inside thead
    const trRegex = /<tr([^>]*)>/;
    return theadMatch.replace(trRegex, (match, classes) => {
      let newClasses = classes;
      // remove old backgrounds
      newClasses = newClasses.replace(/bg-slate-[a-z0-9\/]+/g, '');
      // remove old text colors
      newClasses = newClasses.replace(/text-slate-[a-z0-9\/]+/g, '');
      // remove dark overrides if any
      newClasses = newClasses.replace(/dark:bg-slate-[a-z0-9\/]+/g, '');
      newClasses = newClasses.replace(/dark:text-slate-[a-z0-9\/]+/g, '');
      newClasses = newClasses.replace(/dark:border-slate-[a-z0-9\/]+/g, '');
      // Ensure we have the base classes
      newClasses = newClasses.replace(/className="/, 'className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-300 ');
      
      return `<tr${newClasses}>`;
    });
  });

  if (content !== fs.readFileSync(filePath, 'utf8')) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Fixed thead in ' + f);
  }
});
console.log('Done.');
