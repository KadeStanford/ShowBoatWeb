const fs = require('fs');
const path = require('path');

const src = path.resolve(__dirname, '..');
const dest = path.resolve(__dirname, '..', 'www');

const INCLUDE = ['index.html', 'admin.html', 'sw.js', 'manifest.json', 'css', 'js', 'img'];

function copyRecursive(srcPath, destPath) {
  const stat = fs.statSync(srcPath);
  if (stat.isDirectory()) {
    fs.mkdirSync(destPath, { recursive: true });
    for (const child of fs.readdirSync(srcPath)) {
      copyRecursive(path.join(srcPath, child), path.join(destPath, child));
    }
  } else {
    fs.copyFileSync(srcPath, destPath);
  }
}

// Clean
if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true });
fs.mkdirSync(dest, { recursive: true });

for (const item of INCLUDE) {
  const s = path.join(src, item);
  if (fs.existsSync(s)) {
    copyRecursive(s, path.join(dest, item));
    console.log(`  copied ${item}`);
  }
}

console.log('Build complete → www/');
