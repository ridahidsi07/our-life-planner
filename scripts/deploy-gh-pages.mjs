import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const distDir = path.resolve(process.cwd(), 'dist');

if (!fs.existsSync(distDir) || !fs.existsSync(path.resolve(distDir, 'index.html'))) {
  console.error('dist/index.html not found. Run npm run build first.');
  process.exit(1);
}

// Add .nojekyll to dist so GitHub Pages does not ignore underscore files or assets
fs.writeFileSync(path.resolve(distDir, '.nojekyll'), '');

// Also add a 404.html copying index.html for universal SPA fallback on GitHub Pages
fs.copyFileSync(path.resolve(distDir, 'index.html'), path.resolve(distDir, '404.html'));

console.log('Preparing gh-pages branch deployment...');

function run(cmd) {
  console.log(`> ${cmd}`);
  return execSync(cmd, { stdio: 'inherit' });
}

try {
  // Create or switch to orphan branch
  try {
    execSync('git branch -D gh-pages-deploy', { stdio: 'ignore' });
  } catch {}

  run('git checkout --orphan gh-pages-deploy');
  run('git reset');
  run(`git --work-tree="${distDir}" add --all`);
  run('git commit -m "deploy: publish hosted application to GitHub Pages"');
  run('git push -f origin gh-pages-deploy:gh-pages');
  console.log('Successfully pushed dist to origin/gh-pages!');
} catch (err) {
  console.error('Failed to deploy to gh-pages:', err);
} finally {
  try {
    run('git checkout feat/sell-ready-release');
    execSync('git branch -D gh-pages-deploy', { stdio: 'ignore' });
  } catch (checkoutErr) {
    console.error('Failed to checkout feat/sell-ready-release:', checkoutErr);
  }
}
