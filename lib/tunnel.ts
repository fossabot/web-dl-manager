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

  logger.info('Starting Cloudflare Tunnel...');
  
  tunnelProcess = spawn('cloudflared', ['tunnel', '--no-autoupdate', 'run', '--token', token], {
    stdio: 'ignore',
    detached: true,
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
