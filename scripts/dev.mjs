import { spawn } from 'node:child_process';

const processes = [];
let shuttingDown = false;
const commands = [
  ['API server', process.execPath, ['server/index.mjs']],
  ['React client', process.execPath, ['node_modules/vite/bin/vite.js', '--host', '0.0.0.0']],
];

for (const [name, binary, args] of commands) {
  const child = spawn(binary, args, { stdio: 'inherit', env: process.env });
  processes.push(child);
  child.on('exit', (code) => {
    if (!shuttingDown) {
      console.error(`${name} stopped (code ${code ?? 'unknown'})`);
      shutdown();
    }
  });
}

function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of processes) child.kill();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
