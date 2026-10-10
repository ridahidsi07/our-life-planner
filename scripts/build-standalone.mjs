import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.resolve(rootDir, 'dist');
const publicDir = path.resolve(rootDir, 'public');

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

if (!fs.existsSync(distDir)) {
  console.error('dist/ does not exist. Run vite build first.');
  process.exit(1);
}

const htmlPath = path.resolve(distDir, 'index.html');
let html = fs.readFileSync(htmlPath, 'utf-8');

// Find css and js files in dist/assets
const assetsDir = path.resolve(distDir, 'assets');
const assetFiles = fs.readdirSync(assetsDir);
const cssFile = assetFiles.find((f) => f.endsWith('.css'));
const jsFile = assetFiles.find((f) => f.endsWith('.js'));

if (!cssFile || !jsFile) {
  console.error('Could not find CSS or JS bundle in dist/assets');
  process.exit(1);
}

const cssContent = fs.readFileSync(path.resolve(assetsDir, cssFile), 'utf-8');
const jsContent = fs.readFileSync(path.resolve(assetsDir, jsFile), 'utf-8');

// Escape any raw "</script" sequences inside JS string literals so HTML parser never closes <script> early
const safeJsContent = jsContent.replace(/<\/(script)/gi, '<\\/$1');

// 1. Replace the local asset stylesheet with inline <style> using a replacement callback (() => ...)
// so that $-tokens in CSS are preserved verbatim.
const cssLinkRegex = /<link\b[^>]*href=["'][^"']*\/assets\/[^"']*\.css["'][^>]*>/i;
if (!cssLinkRegex.test(html)) {
  console.error('Could not find local CSS <link> tag in dist/index.html');
  process.exit(1);
}
html = html.replace(cssLinkRegex, () => `<style>\n${cssContent}\n</style>`);

// 2. Remove the external module <script src="/assets/..."> from <head> using a replacement callback
const jsScriptRegex = /<script\b[^>]*src=["'][^"']*\/assets\/[^"']*\.js["'][^>]*><\/script>/i;
if (!jsScriptRegex.test(html)) {
  console.error('Could not find local JS <script> tag in dist/index.html');
  process.exit(1);
}
html = html.replace(jsScriptRegex, () => '');

// 3. Strip external manifest/icon links from single-file offline bundle and mark standalone mode
html = html.replace(/<link\b[^>]*rel=["'](?:manifest|icon|apple-touch-icon)["'][^>]*>\s*/gi, () => '');
const bootstrapPlaceholder = `<script>window.__OLP_STANDALONE_FILE__ = true;</script>\n  <script id="embedded-planner-bootstrap-data" type="application/json">\n<!--BOOTSTRAP_DATA_PLACEHOLDER-->\n</script>`;
html = html.replace(/<\/head>/i, () => `  ${bootstrapPlaceholder}\n  </head>`);

// 4. Insert the inline module bundle right before </body> (after <div id="root"></div>)
// using a replacement callback (() => ...) so $$typeof, $&, $', and $` are preserved byte-for-byte.
html = html.replace(
  /<\/body>/i,
  () => `    <script type="module">\n${safeJsContent}\n</script>\n  </body>`
);

// 5. Build-time integrity verification
const origTypeofCount = (jsContent.match(/\$\$typeof/g) || []).length;
const htmlTypeofCount = (html.match(/\$\$typeof/g) || []).length;

if (origTypeofCount === 0 || htmlTypeofCount !== origTypeofCount) {
  console.error(
    `Standalone bundle integrity check failed: expected ${origTypeofCount} occurrences of $$typeof, found ${htmlTypeofCount}.`
  );
  process.exit(1);
}

if (!html.includes(safeJsContent)) {
  console.error('Standalone bundle integrity check failed: embedded JS content was not preserved verbatim.');
  process.exit(1);
}

if (!html.includes(cssContent)) {
  console.error('Standalone bundle integrity check failed: embedded CSS content was not preserved verbatim.');
  process.exit(1);
}

// Write to public/Our-Life-Planner-Offline.html and dist/Our-Life-Planner-Offline.html
fs.writeFileSync(path.resolve(publicDir, 'Our-Life-Planner-Offline.html'), html, 'utf-8');
fs.writeFileSync(path.resolve(distDir, 'Our-Life-Planner-Offline.html'), html, 'utf-8');

// 6. Populate dist/sw.js with exact hashed build asset paths for offline precaching
const swTemplatePath = path.resolve(publicDir, 'sw.js');
if (fs.existsSync(swTemplatePath)) {
  const swTemplate = fs.readFileSync(swTemplatePath, 'utf-8');
  const buildHash = `${jsFile.replace(/[^a-zA-Z0-9]/g, '')}-${cssFile.replace(/[^a-zA-Z0-9]/g, '')}`;
  const precacheList = [
    '/',
    '/index.html',
    '/manifest.webmanifest',
    '/icon-192.svg',
    '/icon-512.svg',
    `/assets/${cssFile}`,
    `/assets/${jsFile}`,
  ];
  const builtSw = swTemplate
    .replace('__OLP_SW_CACHE_VERSION__', () => `v1-${buildHash}`)
    .replace(
      /\/\*__OLP_PRECACHE_ASSETS__\*\/\s*\[[\s\S]*?\]/,
      () => JSON.stringify(precacheList, null, 2)
    );
  fs.writeFileSync(path.resolve(distDir, 'sw.js'), builtSw, 'utf-8');
}

console.log(
  `Successfully generated and verified standalone offline HTML bundle ($$typeof count preserved: ${htmlTypeofCount})!`
);
