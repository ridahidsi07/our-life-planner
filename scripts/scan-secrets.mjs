import fs from 'node:fs';
import path from 'node:path';

const IGNORED_DIRS = new Set(['.git', 'node_modules', 'dist', '.system_generated']);
const SECRET_PATTERNS = [
  { name: 'AWS Access Key', regex: /AKIA[0-9A-Z]{16}/ },
  { name: 'Generic Secret Key / Token', regex: /(?:api[_-]?key|secret[_-]?key|access[_-]?token|auth[_-]?token)\s*[:=]\s*["']([A-Za-z0-9_\-\.]{16,})["']/i },
  { name: 'Private Key Block', regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: 'Stripe Secret Key', regex: /sk_live_[0-9a-zA-Z]{24}/ },
  { name: 'Google API Key', regex: /AIza[0-9A-Za-z\-_]{35}/ },
  { name: 'GitHub Personal Access Token', regex: /gh[pous]_[A-Za-z0-9_]{36}/ },
];

function scanDir(dir) {
  let issues = [];
  for (const item of fs.readdirSync(dir)) {
    if (IGNORED_DIRS.has(item)) continue;
    const full = path.join(dir, item);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      issues = issues.concat(scanDir(full));
    } else if (stat.isFile()) {
      if ((item === '.env' || item.endsWith('.key') || item.endsWith('.pem')) && !item.endsWith('.example')) {
        issues.push({ file: full, type: 'Sensitive File Extension / Name', line: 1 });
      } else if (!item.endsWith('.example') && !item.endsWith('.pdf') && !item.endsWith('.zip') && !item.endsWith('.png') && !item.endsWith('.jpg')) {
        try {
          const content = fs.readFileSync(full, 'utf8');
          const lines = content.split('\n');
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            for (const pat of SECRET_PATTERNS) {
              const match = pat.regex.exec(line);
              if (match) {
                // NEVER print the actual secret value! Only report file and line number
                issues.push({ file: full, type: pat.name, line: i + 1 });
              }
            }
          }
        } catch {}
      }
    }
  }
  return issues;
}

console.log('Scanning repository for secret patterns and sensitive files...');
const findings = scanDir('.');
console.log(`Scan completed. Found ${findings.length} potential secrets.`);
if (findings.length > 0) {
  console.log('Details:');
  for (const f of findings) {
    console.log(`  - [${f.type}] in ${f.file} at line ${f.line}`);
  }
} else {
  console.log('✓ Clean scan: Zero secret credentials, private keys, or API tokens detected.');
}
