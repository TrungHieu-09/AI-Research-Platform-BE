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

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes('req.ip')) {
    content = content.replace(/req\.ip/g, '"unknown"');
    fs.writeFileSync(file, content, 'utf8');
    console.log('Fixed req.ip in', file);
  }
});
