const { spawn } = require('node:child_process');
const path = require('node:path');

const service = process.argv[2];

if (!service) {
  console.error('Missing service name. Usage: node scripts/pm2-run-dev.js <service>');
  process.exit(1);
}

const repoRoot = path.resolve(__dirname, '..');
const serviceDir = path.join(repoRoot, service);

const child =
  process.platform === 'win32'
    ? spawn(process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe', ['/d', '/s', '/c', 'npm run dev'], {
        cwd: serviceDir,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      })
    : spawn('npm', ['run', 'dev'], {
        cwd: serviceDir,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

let shuttingDown = false;

child.stdout.on('data', (chunk) => process.stdout.write(chunk));
child.stderr.on('data', (chunk) => process.stderr.write(chunk));

function shutdown(signal) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  if (process.platform === 'win32' && child.pid) {
    const killer = spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], {
      stdio: 'ignore',
      windowsHide: true,
    });

    killer.on('exit', () => process.exit(0));
    setTimeout(() => process.exit(0), 1500).unref();
    return;
  }

  if (!child.killed) {
    child.kill(signal);
  }

  setTimeout(() => process.exit(0), 1500).unref();
}

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});

child.on('error', (error) => {
  console.error(`Failed to start npm for ${service}:`, error);
  process.exit(1);
});

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
