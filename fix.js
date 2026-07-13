const fs = require('fs');
const path = require('path');

const walkSync = (dir, filelist = []) => {
  fs.readdirSync(dir).forEach(file => {
    const dirFile = path.join(dir, file);
    if (fs.statSync(dirFile).isDirectory()) {
      filelist = walkSync(dirFile, filelist);
    } else if (file.endsWith('route.ts')) {
      filelist.push(dirFile);
    }
  });
  return filelist;
};

const files = walkSync('d:/ki_7/AI_Research_Platform/server/src/app/api');
let count = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  // Regex to match: { params }: { params: { ... } }
  // and change to: { params }: { params: Promise<{ ... }> }
  const regex1 = /({ params }\s*:\s*{\s*params\s*:\s*)({[^}]+})/g;
  content = content.replace(regex1, (match, p1, p2) => {
    changed = true;
    return p1 + 'Promise<' + p2 + '>';
  });

  if (changed) {
    content = content.replace(/params\.([a-zA-Z0-9_]+)/g, '(await params).$1');
    fs.writeFileSync(file, content, 'utf8');
    console.log('Fixed', file);
    count++;
  }
});
console.log('Total fixed:', count);
