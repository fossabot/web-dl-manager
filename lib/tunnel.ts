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

  logger.info('Starting Cloudflare Tunnel pointing to Main App (port 6275)...');
  
  const isHuggingFace = !!process.env.SPACE_ID || !!process.env.HF_HOME;

  // Point to the main app port 6275
  tunnelProcess = spawn('cloudflared', ['tunnel', '--no-autoupdate', 'run', '--token', token, '--url', 'http://localhost:6275'], {
    stdio: isHuggingFace ? 'ignore' : 'pipe',
    detached: true,
  });

  if (!isHuggingFace) {
    tunnelProcess.stdout?.on('data', (data) => {
      logger.info(`[Tunnel STDOUT] ${data.toString().trim()}`);
    });

    tunnelProcess.stderr?.on('data', (data) => {
      logger.warn(`[Tunnel STDERR] ${data.toString().trim()}`);
    });
  }

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
