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

// Find css file in dist/assets
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

// Replace external stylesheets and scripts with inline tags
// Remove Google Fonts link preconnect or keep them as optional enhancements
html = html.replace(/<link rel="stylesheet"[^>]*href="[^"]*"[^>]*>/i, `<style>\n${cssContent}\n</style>`);
html = html.replace(/<script type="module"[^>]*src="[^"]*"[^>]*><\/script>/i, `<script type="module">\n${jsContent}\n</script>`);

// Add offline bootstrap placeholder before </head>
const bootstrapPlaceholder = `
<script id="embedded-planner-bootstrap-data" type="application/json">
<!--BOOTSTRAP_DATA_PLACEHOLDER-->
</script>
`;
html = html.replace('</head>', `${bootstrapPlaceholder}\n</head>`);

// Write to public/Our-Life-Planner-Offline.html and dist/Our-Life-Planner-Offline.html
fs.writeFileSync(path.resolve(publicDir, 'Our-Life-Planner-Offline.html'), html, 'utf-8');
fs.writeFileSync(path.resolve(distDir, 'Our-Life-Planner-Offline.html'), html, 'utf-8');

console.log('Successfully generated standalone offline HTML bundle!');
