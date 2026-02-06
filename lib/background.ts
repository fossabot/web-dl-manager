import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import { LOGS_DIR, STATUS_DIR } from './constants';
import { dbConfig } from './config';

async function cleanupOldLogs() {
  console.log('[Background] Running log cleanup...');
  if (fs.existsSync(LOGS_DIR)) {
    const files = fs.readdirSync(LOGS_DIR);
    const now = Date.now();
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days

    files.forEach(file => {
      const filePath = path.join(LOGS_DIR, file);
      const stats = fs.statSync(filePath);
      if (now - stats.mtimeMs > maxAge) {
        fs.unlinkSync(filePath);
      }
    });
  }
}

interface SyncTask {
  name: string;
  local_path: string;
  remote_path: string;
  interval: number;
  enabled: boolean;
  is_system?: boolean;
}

const lastRunTimes: Record<string, number> = {};

async function runRcloneCopy(source: string, dest: string, configContent: string): Promise<boolean> {
  const configPath = path.join(os.tmpdir(), `rclone_sync_${Date.now()}.conf`);
  fs.writeFileSync(configPath, configContent);

  return new Promise((resolve) => {
    const child = spawn('rclone', ['copy', source, dest, '--config', configPath, '--log-level', 'INFO']);
    child.on('close', (code) => {
        fs.unlinkSync(configPath);
        resolve(code === 0);
    });
  });
}

async function unifiedPeriodicSync() {
  const tasksJson = await dbConfig.getConfig('WDM_SYNC_TASKS_JSON', '[]');
  let customTasks: SyncTask[] = [];
  try {
    customTasks = JSON.parse(tasksJson!);
  } catch (e) {
    console.error('[Sync] Failed to parse sync tasks JSON');
  }

  // System Task: Gallery-dl Config Backup
  const homeDir = os.homedir();
  const galleryDlConfigDir = path.join(homeDir, '.config', 'gallery-dl');
  const backupRemotePath = await dbConfig.getConfig('WDM_CONFIG_BACKUP_REMOTE_PATH');
  
  if (backupRemotePath) {
      customTasks.push({
          name: "System: Gallery-dl Config",
          local_path: galleryDlConfigDir,
          remote_path: backupRemotePath,
          interval: 60, // 1 hour
          enabled: true,
          is_system: true
      });
  }

  const rcloneBase64 = await dbConfig.getConfig('WDM_CONFIG_BACKUP_RCLONE_BASE64');
  if (!rcloneBase64) return;

  const rcloneConfigContent = Buffer.from(rcloneBase64, 'base64').toString('utf-8');
  const now = Date.now();

  for (const task of customTasks) {
      if (!task.enabled || !task.local_path || !task.remote_path) continue;

      const lastRun = lastRunTimes[task.name] || 0;
      const intervalMs = task.interval * 60 * 1000;

      if (now - lastRun >= intervalMs) {
          if (fs.existsSync(task.local_path)) {
              console.log(`[Sync] Running task: ${task.name}`);
              const success = await runRcloneCopy(task.local_path, task.remote_path, rcloneConfigContent);
              if (success) {
                  console.log(`[Sync] Success: ${task.name}`);
                  lastRunTimes[task.name] = now;
              } else {
                  console.error(`[Sync] Failed: ${task.name}`);
              }
          }
      }
  }
}

export function startBackgroundTasks() {
  // Run cleanup every hour
  setInterval(cleanupOldLogs, 3600 * 1000);
  
  // Run sync check every 30 seconds
  setInterval(unifiedPeriodicSync, 30 * 1000);
  
  console.log('[Background] Periodic tasks started.');
}