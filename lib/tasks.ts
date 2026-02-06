import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import { STATUS_DIR, DOWNLOADS_DIR, ARCHIVES_DIR } from './constants';
import { dbConfig } from './config';
import { createRcloneConfig } from './rclone';
import { createNetscapeCookies } from './utils';
import { uploadFile as uploadToOpenlist, login as loginOpenlist, createDirectory as createDirOpenlist } from './openlist';
import { uploadToGofile } from './gofile';
import { logger } from './logger';

export interface TaskStatus {
  id: string;
  status: 'queued' | 'running' | 'compressing' | 'uploading' | 'completed' | 'failed' | 'paused';
  url: string;
  downloader: string;
  uploadService: string;
  uploadPath: string;
  createdAt: string;
  createdBy: string;
  pid?: number;
  error?: string;
  progressCount?: string;
  gofileLink?: string;
  uploadStats?: {
    totalFiles: number;
    uploadedFiles: number;
    percent: number;
    totalSize?: number;
    uploadedSize?: number;
    currentFile?: string;
    transferred?: string;
    total?: string;
    filePercent?: number;
  };
  originalParams?: TaskParams;
}

export interface TaskParams {
  url: string;
  downloader: string;
  upload_service: string;
  upload_path: string;
  enable_compression: string | boolean;
  split_compression: string | boolean;
  split_size: string | number;
  createdBy: string;
  kemono_username?: string;
  kemono_password?: string;
  cookies?: string;
  kemono_posts?: number;
  kemono_revisions?: string;
  pixiv_ugoira?: string;
  kemono_path_template?: string;
  gofile_token?: string;
  gofile_folder_id?: string;
  openlist_url?: string;
  openlist_user?: string;
  openlist_pass?: string;
}

const activeProcesses = new Map<string, ChildProcess>();
const taskQueue: { taskId: string; params: TaskParams }[] = [];
let runningTasks = 0;
const MAX_CONCURRENT_TASKS = 2;

export function getActiveTaskCount(): number {
  return runningTasks;
}

export function getTaskStatusPath(taskId: string): string {
  return path.join(STATUS_DIR, `${taskId}.json`);
}

export function updateTaskStatus(taskId: string, updates: Partial<TaskStatus>) {
  const statusPath = getTaskStatusPath(taskId);
  let statusData: Partial<TaskStatus> = {};
  if (fs.existsSync(statusPath)) {
    try {
      statusData = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
    } catch {
      // Ignore
    }
  }
  const finalData = { ...statusData, ...updates, id: taskId };
  fs.writeFileSync(statusPath, JSON.stringify(finalData, null, 2));
}

async function runCommand(
  taskId: string,
  command: string,
  args: string[],
  logFile: string,
  env: Record<string, string> = {}
): Promise<number> {
  return new Promise((resolve, reject) => {
    const logStream = fs.createWriteStream(logFile, { flags: 'a' });
    const cmdStr = `${command} ${args.join(' ')}`;
    logStream.write(`\n[Executing] ${cmdStr}\n`);

    const child = spawn(command, args, {
      env: { ...process.env, ...env },
      shell: true,
    });

    activeProcesses.set(taskId, child);
    updateTaskStatus(taskId, { pid: child.pid });

    child.stdout.pipe(logStream);
    child.stderr.pipe(logStream);

    child.on('close', (code) => {
      activeProcesses.delete(taskId);
      updateTaskStatus(taskId, { pid: undefined });
      if (code === 0) resolve(code);
      else reject(new Error(`Command failed with exit code ${code}`));
    });

    child.on('error', (err) => {
      activeProcesses.delete(taskId);
      reject(err);
    });
  });
}

async function executeJob(taskId: string, params: TaskParams) {
  const { url, downloader, upload_service: uploadService, upload_path: uploadPath, enable_compression: enableCompression, createdBy } = params;
  const statusFile = path.join(STATUS_DIR, `${taskId}.log`);
  const uploadLogFile = path.join(STATUS_DIR, `${taskId}_upload.log`);
  const taskDownloadDir = path.join(DOWNLOADS_DIR, taskId);
  
  let tempCookieFile: string | null = null;
  let rcloneConfigPath: string | null = null;
  const archivePaths: string[] = [];

  try {
    updateTaskStatus(taskId, { 
      status: 'running', 
      url, 
      downloader, 
      uploadService, 
      uploadPath, 
      createdAt: new Date().toISOString(), 
      createdBy,
      originalParams: params
    });
    fs.writeFileSync(statusFile, `Starting job ${taskId} for URL: ${url}\n`);

    if (!fs.existsSync(taskDownloadDir)) {
      fs.mkdirSync(taskDownloadDir, { recursive: true });
    }

    // --- 1. Downloader Logic ---
    if (downloader === 'kemono-dl') {
      const kemonoUser = params.kemono_username || await dbConfig.getConfig('WDM_KEMONO_USERNAME');
      const kemonoPass = params.kemono_password || await dbConfig.getConfig('WDM_KEMONO_PASSWORD');
      
      const args = ['-m', 'kemono_dl', '--path', taskDownloadDir, url];
      args.push('--output', '{service}/{creator_name}/{post_title}/{filename}');

      if (params.cookies) {
        tempCookieFile = createNetscapeCookies(params.cookies);
        args.push('--cookies', tempCookieFile);
      } else if (kemonoUser && kemonoPass) {
        args.push('--kemono-login', kemonoUser, kemonoPass);
      }
      
      await runCommand(taskId, 'python3', args, statusFile);

    } else if (downloader === 'megadl') {
      const args = ['--path', taskDownloadDir, url];
      await runCommand(taskId, 'megadl', args, statusFile);

    } else {
      const args = ['--verbose', '--directory', taskDownloadDir];
      if (params.cookies) {
        tempCookieFile = createNetscapeCookies(params.cookies);
        args.push('--cookies', tempCookieFile);
      }
      if (params.kemono_posts) args.push('-o', `extractor.kemono.posts=${params.kemono_posts}`);
      if (params.kemono_revisions === 'true') args.push('-o', 'extractor.kemono.revisions=true');
      if (params.pixiv_ugoira === 'false') args.push('-o', 'extractor.pixiv.ugoira=false');
      
      if (params.kemono_path_template === 'true') {
          args.push('-o', "directory=['{user}', '{title}']");
      }

      const extraArgs = await dbConfig.getConfig('WDM_GALLERY_DL_ARGS');
      if (extraArgs) args.push(...extraArgs.split(' '));

      args.push(url);
      await runCommand(taskId, 'gallery-dl', args, statusFile);
    }

    // --- 2. Compression Logic ---
    const useCompression = enableCompression === 'true' || enableCompression === true;
    
    if (useCompression) {
      updateTaskStatus(taskId, { status: 'compressing' });
      const archiveName = `archive_${taskId}.tar.zst`;
      const archivePath = path.join(ARCHIVES_DIR, archiveName);
      
      await runCommand(taskId, 'tar', ['-cf', '-', '-C', taskDownloadDir, '.', '|', 'zstd', '-o', archivePath], statusFile);
      archivePaths.push(archivePath);
    }

    // --- 3. Upload Logic ---
    updateTaskStatus(taskId, { status: 'uploading' });
    
    if (uploadService === 'gofile') {
      const token = params.gofile_token || await dbConfig.getConfig('WDM_GOFILE_TOKEN');
      const folderId = params.gofile_folder_id || await dbConfig.getConfig('WDM_GOFILE_FOLDER_ID');
      
      for (const file of archivePaths) {
        const link = await uploadToGofile(file, token || undefined, folderId || undefined, (msg) => fs.appendFileSync(uploadLogFile, msg + '\n'));
        updateTaskStatus(taskId, { gofileLink: link });
      }
    } else if (uploadService === 'openlist') {
      const olUrl = params.openlist_url || await dbConfig.getConfig('WDM_OPENLIST_URL');
      const olUser = params.openlist_user || await dbConfig.getConfig('WDM_OPENLIST_USER');
      const olPass = params.openlist_pass || await dbConfig.getConfig('WDM_OPENLIST_PASS');
      
      if (!olUrl || !olUser || !olPass) throw new Error('Openlist credentials missing');
      
      const token = await loginOpenlist(olUrl, olUser, olPass);
      await createDirOpenlist(olUrl, token, uploadPath);
      
      for (const file of archivePaths) {
        await uploadToOpenlist(olUrl, token, file, uploadPath);
      }
    } else {
      rcloneConfigPath = await createRcloneConfig(taskId, uploadService, params);
      if (!rcloneConfigPath) throw new Error(`Failed to generate Rclone config for ${uploadService}`);
      
      if (useCompression) {
        for (const file of archivePaths) {
          const remoteDest = `${uploadService}:${uploadPath}/${path.basename(file)}`;
          await runCommand(taskId, 'rclone', ['copyto', '--config', rcloneConfigPath, file, remoteDest, '-P'], uploadLogFile);
        }
      } else {
        const remoteDest = `${uploadService}:${uploadPath}`;
        await runCommand(taskId, 'rclone', ['copy', '--config', rcloneConfigPath, taskDownloadDir, remoteDest, '-P'], uploadLogFile);
      }
    }

    updateTaskStatus(taskId, { status: 'completed', progressCount: '100%' });
    logger.info(`Task ${taskId} completed successfully.`);

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    updateTaskStatus(taskId, { status: 'failed', error: errorMsg });
    fs.appendFileSync(statusFile, `\n--- JOB FAILED ---\n${errorMsg}\n`);
    logger.error(`Task ${taskId} failed: ${errorMsg}`);
  } finally {
    if (tempCookieFile && fs.existsSync(tempCookieFile)) fs.unlinkSync(tempCookieFile);
    if (rcloneConfigPath && fs.existsSync(rcloneConfigPath)) fs.unlinkSync(rcloneConfigPath);
  }
}

async function processQueue() {
  if (runningTasks >= MAX_CONCURRENT_TASKS || taskQueue.length === 0) {
    return;
  }

  const item = taskQueue.shift();
  if (!item) return;

  runningTasks++;

  try {
    await executeJob(item.taskId, item.params);
  } finally {
    runningTasks--;
    // Using setTimeout to prevent deep recursion
    setTimeout(() => {
      processQueue();
    }, 0);
  }
}

export async function processDownloadJob(taskId: string, params: TaskParams) {
  // Add to queue
  taskQueue.push({ taskId, params });
  // Start queue processing if not already saturated
  processQueue();
}