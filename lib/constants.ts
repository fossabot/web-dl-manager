import path from 'path';
import fs from 'fs';
import os from 'os';

export const PROJECT_ROOT = process.cwd();
export const DATA_ROOT = path.join(PROJECT_ROOT, 'data');
export const DOWNLOADS_DIR = path.join(DATA_ROOT, 'downloads');
export const ARCHIVES_DIR = path.join(DATA_ROOT, 'archives');
export const STATUS_DIR = path.join(DATA_ROOT, 'status');
export const LOGS_DIR = path.join(PROJECT_ROOT, 'logs');
export const GALLERY_DL_CONFIG_DIR = path.join(os.homedir(), '.config', 'gallery-dl');
export const CAMOUFLAGE_DIR = path.join(PROJECT_ROOT, 'public', 'camouflage');

// Ensure directories exist
[DATA_ROOT, DOWNLOADS_DIR, ARCHIVES_DIR, STATUS_DIR, LOGS_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});
