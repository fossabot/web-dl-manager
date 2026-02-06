import fs from 'fs';
import path from 'path';
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

async function unifiedPeriodicSync() {
  // Implement sync logic using rclone...
  // This would involve reading WDM_SYNC_TASKS_JSON and running rclone copy
  // Similar to the Python implementation.
}

export function startBackgroundTasks() {
  // Run cleanup every hour
  setInterval(cleanupOldLogs, 3600 * 1000);
  
  // Run sync check every 30 seconds
  setInterval(unifiedPeriodicSync, 30 * 1000);
  
  console.log('[Background] Periodic tasks started.');
}
