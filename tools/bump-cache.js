#!/usr/bin/env node
/* ============================================================
   Opex Logistics — cache buster
   Usage:  node tools/bump-cache.js
   Stamps ?v=N onto every assets/css|js reference in all HTML
   files (root + admin/), so stale immutable caches are bypassed.
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const versionFile = path.join(root, '.cacheversion');

let v = 1;
try { v = parseInt(fs.readFileSync(versionFile, 'utf8'), 10) || 1; } catch (e) { /* first run */ }
v += 1;
fs.writeFileSync(versionFile, String(v));

const htmlFiles = [];
for (const dir of [root, path.join(root, 'admin')]) {
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir)) {
    if (f.toLowerCase().endsWith('.html')) htmlFiles.push(path.join(dir, f));
  }
}

const re = /((?:\.\.\/)?assets\/(?:css|js)\/[A-Za-z0-9._\/-]+\.(?:css|js))(?:\?v=\d+)?/g;

let touched = 0, refs = 0;
for (const file of htmlFiles) {
  const src = fs.readFileSync(file, 'utf8');
  const out = src.replace(re, (m, p1) => { refs++; return p1 + '?v=' + v; });
  if (out !== src) {
    fs.writeFileSync(file, out);
    touched++;
    console.log('  stamped  ' + path.relative(root, file));
  }
}

console.log('\nCache version  ->  v' + v);
console.log('HTML files     ->  ' + touched + ' updated, ' + refs + ' asset references stamped');
console.log('\nNow commit and redeploy:');
console.log('  git add -A && git commit -m "cache bust v' + v + '" && git push');
console.log('  (or: vercel --prod)');
