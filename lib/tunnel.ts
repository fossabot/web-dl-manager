import { spawn, ChildProcess } from 'child_process';
import { logger } from './logger';
import { dbConfig } from './config';

let tunnelProcess: ChildProcess | null = null;

export async function startTunnel() {
  const token = await dbConfig.getConfig('TUNNEL_TOKEN') || process.env.TUNNEL_TOKEN;
  
  if (!token) {
    logger.info('Cloudflare Tunnel token not set, skipping.');
    return;
  }

  if (tunnelProcess) {
    logger.info('Cloudflare Tunnel is already running.');
    return;
  }

  logger.info('Starting Cloudflare Tunnel on port 5492...');
  
  // Explicitly point to the camouflage port 5492
  tunnelProcess = spawn('cloudflared', ['tunnel', '--no-autoupdate', 'run', '--token', token, '--url', 'http://localhost:5492'], {
    stdio: 'pipe',
    detached: true,
  });

  tunnelProcess.stdout?.on('data', (data) => {
    logger.info(`[Tunnel STDOUT] ${data.toString().trim()}`);
  });

  tunnelProcess.stderr?.on('data', (data) => {
    logger.warn(`[Tunnel STDERR] ${data.toString().trim()}`);
  });

  tunnelProcess.unref();

  tunnelProcess.on('exit', (code) => {
    logger.warn(`Cloudflare Tunnel exited with code ${code}`);
    tunnelProcess = null;
  });
}

export function stopTunnel() {
  if (tunnelProcess) {
    tunnelProcess.kill();
    tunnelProcess = null;
    logger.info('Cloudflare Tunnel stopped.');
  }
}
