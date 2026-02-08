import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import axios from 'axios';
import { PROJECT_ROOT } from './constants';
import { logger } from './logger';

const OWNER = "Jyf0214";
const REPO = "web-dl-manager";
const BRANCH = "next";
const VERSION_INFO_FILE = path.join(PROJECT_ROOT, '.version_info');

export function getLocalCommitSha(): string | null {
  try {
    // eslint-disable-next-line sonarjs/no-os-command-from-path
    const sha = execSync('git rev-parse HEAD', { cwd: PROJECT_ROOT }).toString().trim();
    return sha;
  } catch {
    if (fs.existsSync(VERSION_INFO_FILE)) {
      return fs.readFileSync(VERSION_INFO_FILE, 'utf8').trim();
    }
  }
  return null;
}

export async function getRemoteCommitSha(): Promise<string | null> {
  try {
    const url = `https://api.github.com/repos/${OWNER}/${REPO}/commits/${BRANCH}`;
    const res = await axios.get(url);
    return res.data.sha;
  } catch (e) {
    logger.error('Failed to fetch remote SHA:', e);
  }
  return null;
}

export async function checkForUpdates() {
  const localSha = getLocalCommitSha();
  const remoteSha = await getRemoteCommitSha();
  
  if (!remoteSha) return { update_available: false, error: 'Could not fetch remote version' };

  return {
    update_available: localSha !== remoteSha,
    current_version: localSha?.substring(0, 7) || 'N/A',
    latest_version: remoteSha.substring(0, 7),
    current_full_sha: localSha,
    latest_full_sha: remoteSha
  };
}

export async function runUpdate() {
  try {
    logger.info('Starting update via git pull...');
    // eslint-disable-next-line sonarjs/no-os-command-from-path
    execSync('git pull', { cwd: PROJECT_ROOT });
    // eslint-disable-next-line sonarjs/no-os-command-from-path
    execSync('npm install', { cwd: PROJECT_ROOT });
    // In a real environment, we would need to rebuild and restart
    // For now, we just indicate success
    return { status: 'success', updated: true };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    logger.error('Update failed:', message);
    return { status: 'error', message };
  }
}

export function restartApplication() {
  logger.info('Restarting application...');
  // Use PM2 to restart if available, or just exit and let the supervisor handle it
  try {
    // eslint-disable-next-line sonarjs/no-os-command-from-path
    execSync('pm2 restart ecosystem.config.js', { cwd: PROJECT_ROOT });
  } catch {
    process.exit(0);
  }
}