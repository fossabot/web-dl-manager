import fs from 'fs';
import path from 'path';
import axios from 'axios';
import os from 'os';
import si from 'systeminformation';

let lastNetStats: { time: number; rx: number; tx: number } | null = null;

export async function getNetSpeed() {
  const stats = await si.networkStats();
  const now = Date.now();
  
  // Sum up all interfaces
  let currentRx = 0;
  let currentTx = 0;
  stats.forEach(s => {
    currentRx += s.rx_bytes;
    currentTx += s.tx_bytes;
  });

  if (!lastNetStats) {
    lastNetStats = { time: now, rx: currentRx, tx: currentTx };
    return { rx: 0, tx: 0 };
  }

  const interval = (now - lastNetStats.time) / 1000;
  if (interval <= 0) return { rx: 0, tx: 0 };

  const rxSpeed = (currentRx - lastNetStats.rx) / interval;
  const txSpeed = (currentTx - lastNetStats.tx) / interval;

  lastNetStats = { time: now, rx: currentRx, tx: currentTx };

  return {
    rx: Math.max(0, rxSpeed),
    tx: Math.max(0, txSpeed)
  };
}

export function createNetscapeCookies(cookiesStr: string): string {
  const tempPath = path.join(os.tmpdir(), `cookies_${Date.now()}.txt`);
  let content = "# Netscape HTTP Cookie File\n";
  content += "# http://curl.haxx.se/rfc/cookie_spec.html\n\n";

  const cookies = cookiesStr.split(';');
  for (const cookie of cookies) {
    const parts = cookie.trim().split('=');
    if (parts.length >= 2) {
      const name = parts[0];
      const value = parts.slice(1).join('=');
      // Default to common domains if not specified, usually cookies are passed for specific sites
      ['.kemono.cr', '.kemono.su', '.coomer.st', '.coomer.su', '.pixiv.net', '.twitter.com'].forEach(domain => {
         content += `${domain}\tTRUE\t/\tFALSE\t0\t${name}\t${value}\n`;
      });
    }
  }

  fs.writeFileSync(tempPath, content);
  return tempPath;
}

export async function getWorkingProxy(logCallback?: (msg: string) => void): Promise<string | null> {
  const proxyListUrl = "https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt";
  if (logCallback) logCallback("Fetching proxy list...");
  
  try {
    const res = await axios.get(proxyListUrl);
    const proxies = res.data.split('\n').filter((p: string) => p.trim());
    
    // Return a random one for now to avoid heavy network operations in this environment
    if (proxies.length > 0) {
        const randomProxy = proxies[Math.floor(Math.random() * proxies.length)];
        if (logCallback) logCallback(`Selected proxy: ${randomProxy}`);
        return `http://${randomProxy}`;
    }
  } catch (e) {
    if (logCallback) logCallback(`Failed to fetch proxies: ${e}`);
  }
  return null;
}

// Helper functions and utilities for the application
export function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function getSystemInfo() {
  const cpus = os.cpus();
  const memTotal = os.totalmem();
  const memFree = os.freemem();
  
  return {
    cpuModel: cpus[0].model,
    cpuCount: cpus.length,
    memTotal,
    memFree,
    memUsed: memTotal - memFree,
    uptime: os.uptime(),
    platform: `${os.type()} ${os.release()}`
  };
}