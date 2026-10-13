import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const rootDir = process.cwd();
const deliveryDir = path.resolve(rootDir, 'artifacts', 'delivery');
const pkgDir = path.resolve(deliveryDir, 'package');
const distDir = path.resolve(rootDir, 'dist');
const zipDest = path.resolve(distDir, 'Our-Life-Planner-v1.0.0-Delivery.zip');

if (fs.existsSync(pkgDir)) {
  fs.rmSync(pkgDir, { recursive: true, force: true });
}
fs.mkdirSync(pkgDir, { recursive: true });

const filesToInclude = [
  { src: path.resolve(distDir, 'Our-Life-Planner-Offline.html'), dest: 'Our-Life-Planner-Offline.html' },
  { src: path.resolve(deliveryDir, 'Our-Life-Planner-Getting-Started-Guide.pdf'), dest: 'Our-Life-Planner-Getting-Started-Guide.pdf' },
  { src: path.resolve(deliveryDir, 'README-START-HERE.txt'), dest: 'README-START-HERE.txt' },
  { src: path.resolve(deliveryDir, 'ETSY-DOWNLOAD-INSTRUCTIONS.md'), dest: 'ETSY-DOWNLOAD-INSTRUCTIONS.md' },
  { src: path.resolve(deliveryDir, 'ONLINE-ACCESS-INSTRUCTIONS.md'), dest: 'ONLINE-ACCESS-INSTRUCTIONS.md' },
  { src: path.resolve(deliveryDir, 'BACKUP-AND-UPGRADE-GUIDE.md'), dest: 'BACKUP-AND-UPGRADE-GUIDE.md' },
  { src: path.resolve(deliveryDir, 'COMPATIBILITY-AND-REQUIREMENTS.md'), dest: 'COMPATIBILITY-AND-REQUIREMENTS.md' },
  { src: path.resolve(deliveryDir, 'SUPPORT-AND-TERMS.md'), dest: 'SUPPORT-AND-TERMS.md' },
  { src: path.resolve(deliveryDir, 'LICENSE-AND-NOTICES.txt'), dest: 'LICENSE-AND-NOTICES.txt' },
];

console.log('Assembling package files...');
for (const item of filesToInclude) {
  if (!fs.existsSync(item.src)) {
    console.error(`Missing required file: ${item.src}`);
    process.exit(1);
  }
  const destPath = path.resolve(pkgDir, item.dest);
  fs.copyFileSync(item.src, destPath);
  const stat = fs.statSync(destPath);
  console.log(`  ✓ ${item.dest} (${(stat.size / 1024).toFixed(1)} KB)`);
}

// Also ensure copy exists in deliveryDir
fs.copyFileSync(path.resolve(distDir, 'Our-Life-Planner-Offline.html'), path.resolve(deliveryDir, 'Our-Life-Planner-Offline.html'));

if (fs.existsSync(zipDest)) {
  fs.unlinkSync(zipDest);
}

console.log('Compressing into zip archive...');
// Use PowerShell Compress-Archive
const psCmd = `powershell -NoProfile -Command "Compress-Archive -Path '${pkgDir}\\*' -DestinationPath '${zipDest}' -Force"`;
execSync(psCmd, { stdio: 'inherit' });

if (!fs.existsSync(zipDest)) {
  console.error('Failed to create ZIP package!');
  process.exit(1);
}

const zipStat = fs.statSync(zipDest);
const zipSizeMb = zipStat.size / (1024 * 1024);
console.log(`\nSuccessfully created ${path.basename(zipDest)}:`);
console.log(`  Size: ${zipStat.size} bytes (${zipSizeMb.toFixed(2)} MB)`);
console.log(`  Etsy Limit Check: ${zipSizeMb < 20 ? 'PASSED (< 20 MB)' : 'FAILED (>= 20 MB)'}`);
