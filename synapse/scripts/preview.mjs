// Starts a local preview with its own database; never changes the git branch.
import { spawnSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
if (Number(process.versions.node.split('.')[0]) < 22) {
  console.error('Install Node.js 22 LTS or newer, then run this launcher again.'); process.exit(1);
}
const env = { ...process.env, TURSO_DATABASE_URL: 'file:preview.db', TURSO_AUTH_TOKEN: '', SYNAPSE_PREVIEW: '1' };
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
for (const args of [['ci'], ['run', 'db:init']]) {
  const result = spawnSync(npm, args, { cwd: app, env, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) { console.error('Setup failed. Read the error above; your main database has not been changed.'); process.exit(1); }
}
console.log('\nPREVIEW: http://localhost:3030\nOpen that address, then click Load demo packets.\nDatabase: synapse/preview.db. Commands disabled. Ctrl+C stops the server.\n');
const child = spawn(process.execPath, [resolve(app, 'node_modules/next/dist/bin/next'), 'dev', '--hostname', '127.0.0.1', '--port', '3030'], { cwd: app, env, stdio: 'inherit' });
child.on('error', error => { console.error(error); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 0; });
process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
