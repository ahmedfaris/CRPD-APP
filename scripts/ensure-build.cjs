// Rebuilds the app (npm run build) when the compiled files in dist/ are missing or older
// than the source code, e.g. after "git pull". Used by windows-start.bat and "npm start".
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const builtFiles = [path.join(root, 'dist', 'index.html'), path.join(root, 'dist', 'server.cjs')];
const sources = ['src', 'server.ts', 'index.html', 'vite.config.ts', 'package.json', 'middleware'];

function newest(p) {
  let st;
  try { st = fs.statSync(p); } catch { return 0; }
  if (!st.isDirectory()) return st.mtimeMs;
  let m = 0;
  for (const name of fs.readdirSync(p)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    m = Math.max(m, newest(path.join(p, name)));
  }
  return m;
}

const builtAt = Math.min(...builtFiles.map(f => { try { return fs.statSync(f).mtimeMs; } catch { return 0; } }));
const changedAt = Math.max(...sources.map(s => newest(path.join(root, s))));

if (builtAt > 0 && builtAt >= changedAt) {
  console.log('[build] The compiled app is up to date.');
  process.exit(0);
}
console.log(builtAt === 0
  ? '[build] No compiled app found. Building it now (about a minute)...'
  : '[build] The source code is newer than the compiled app (for example after an update). Rebuilding (about a minute)...');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const r = spawnSync(npm, ['run', 'build'], { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
if (r.status !== 0) {
  console.error('[build] The build failed. The app was not started with old files. See the errors above.');
  process.exit(r.status || 1);
}
console.log('[build] Build finished.');
