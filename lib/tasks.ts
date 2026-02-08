import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import { STATUS_DIR, DOWNLOADS_DIR, ARCHIVES_DIR, GALLERY_DL_CONFIG_DIR } from './constants';
import { dbConfig } from './config';
import { createRcloneConfig, runRcloneCommand } from './rclone';
import { createNetscapeCookies, formatSize } from './utils';
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

// --- Gallery-dl Config Backup/Restore ---

export async function restoreGalleryDlConfig() {
  const rcloneBase64 = await dbConfig.getConfig('WDM_CONFIG_BACKUP_RCLONE_BASE64');
  const remotePath = await dbConfig.getConfig('WDM_CONFIG_BACKUP_REMOTE_PATH');

  if (!rcloneBase64 || !remotePath) {
    logger.info("Configuration restore not configured. Skipping.");
    return;
  }

  logger.info("Attempting to restore gallery-dl config from rclone remote...");
  if (!fs.existsSync(GALLERY_DL_CONFIG_DIR)) {
    fs.mkdirSync(GALLERY_DL_CONFIG_DIR, { recursive: true });
  }

  const tmpConfigPath = path.join('/tmp', `restore_${Date.now()}.conf`);
  try {
    const configContent = Buffer.from(rcloneBase64, 'base64').toString('utf-8');
    fs.writeFileSync(tmpConfigPath, configContent);

    const rcloneCmd = `rclone copy "remote:${remotePath}" "${GALLERY_DL_CONFIG_DIR}" --config "${tmpConfigPath}" -P --log-level=INFO`;
    await runRcloneCommand(rcloneCmd);
    logger.info("Finished attempt to restore gallery-dl config.");
  } catch (error) {
    logger.error("Failed to restore gallery-dl config:", error);
  } finally {
    if (fs.existsSync(tmpConfigPath)) fs.unlinkSync(tmpConfigPath);
  }
}

export async function backupGalleryDlConfig() {
  const rcloneBase64 = await dbConfig.getConfig('WDM_CONFIG_BACKUP_RCLONE_BASE64');
  const remotePath = await dbConfig.getConfig('WDM_CONFIG_BACKUP_REMOTE_PATH');

  if (!rcloneBase64 || !remotePath || !fs.existsSync(GALLERY_DL_CONFIG_DIR)) return;

  logger.info("Backing up gallery-dl config to rclone remote...");
  const tmpConfigPath = path.join('/tmp', `backup_${Date.now()}.conf`);
  try {
    const configContent = Buffer.from(rcloneBase64, 'base64').toString('utf-8');
    fs.writeFileSync(tmpConfigPath, configContent);

    const rcloneCmd = `rclone copy "${GALLERY_DL_CONFIG_DIR}" "remote:${remotePath}" --config "${tmpConfigPath}" --log-level=INFO`;
    await runRcloneCommand(rcloneCmd);
    logger.info("Gallery-dl config backup successful.");
  } catch (error) {
    logger.error("Failed to backup gallery-dl config:", error);
  } finally {
    if (fs.existsSync(tmpConfigPath)) fs.unlinkSync(tmpConfigPath);
  }
}

// --- Periodic Sync ---

// Moved to lib/background.ts

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
  env: Record<string, string> = {},
  maxRetries: number = 3
): Promise<number> {
  const retryDelays = [5000, 10000, 15000]; // ms
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await new Promise<number>((resolve, reject) => {
        const logStream = fs.createWriteStream(logFile, { flags: 'a' });
        const cmdStr = `${command} ${args.join(' ')}`;
        logStream.write(`\n[Attempt ${attempt + 1}/${maxRetries}] Executing: ${cmdStr}\n`);

        // eslint-disable-next-line sonarjs/os-command
        const child = spawn(command, args, {
          env: { ...process.env, ...env, PYTHONUNBUFFERED: '1' },
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
      return result;
    } catch (err) {
      lastError = err as Error;
      if (attempt < maxRetries - 1) {
        const delay = retryDelays[attempt] || 5000;
        fs.appendFileSync(logFile, `\n[Attempt ${attempt + 1}] Failed: ${lastError.message}. Retrying in ${delay / 1000}s...\n`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError || new Error('All retry attempts failed');
}

async function compressInChunks(taskId: string, sourceDir: string, archiveNameBase: string, maxSizeMB: number, statusFile: string): Promise<string[]> {
  const archivePaths: string[] = [];
  const maxSize = maxSizeMB * 1024 * 1024;
  let currentChunk: string[] = [];
  let currentSize = 0;
  let chunkNumber = 1;

  const files = getAllFiles(sourceDir);

  const compressChunk = async (chunkFiles: string[], chunkNum: number) => {
    const archivePath = path.join(ARCHIVES_DIR, `${archiveNameBase}_${chunkNum}.tar.zst`);
    const fileListPath = path.join(STATUS_DIR, `${taskId}_chunk_${chunkNum}.txt`);
    
    fs.writeFileSync(fileListPath, chunkFiles.map(f => path.relative(sourceDir, f)).join('\n'));
    
    const compressCmd = `tar -cf - -C "${sourceDir}" --files-from="${fileListPath}" | zstd -o "${archivePath}"`;
    await runCommand(taskId, 'sh', ['-c', compressCmd], statusFile);
    
    archivePaths.push(archivePath);
    if (fs.existsSync(fileListPath)) fs.unlinkSync(fileListPath);
  };

  for (const file of files) {
    const stats = fs.statSync(file);
    if (currentSize + stats.size > maxSize && currentChunk.length > 0) {
      await compressChunk(currentChunk, chunkNumber);
      currentChunk = [];
      currentSize = 0;
      chunkNumber++;
    }
    currentChunk.push(file);
    currentSize += stats.size;
  }

  if (currentChunk.length > 0) {
    await compressChunk(currentChunk, chunkNumber);
  }

  return archivePaths;
}

function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
    } else {
      arrayOfFiles.push(fullPath);
    }
  });

  return arrayOfFiles;
}

async function uploadUncompressed(taskId: string, service: string, uploadPath: string, params: TaskParams, statusFile: string) {
  const taskDownloadDir = path.join(DOWNLOADS_DIR, taskId);
  
  if (service === 'gofile') {
     fs.appendFileSync(statusFile, "\nUncompressed upload is not supported for gofile.io.\n");
     return;
  }

  if (service === 'openlist') {
    const olUrl = params.openlist_url || await dbConfig.getConfig('WDM_OPENLIST_URL');
    const olUser = params.openlist_user || await dbConfig.getConfig('WDM_OPENLIST_USER');
    const olPass = params.openlist_pass || await dbConfig.getConfig('WDM_OPENLIST_PASS');
    
    if (!olUrl || !olUser || !olPass) throw new Error('Openlist credentials missing');
    
    const token = await loginOpenlist(olUrl, olUser, olPass);
    await createDirOpenlist(olUrl, token, uploadPath);

    const files = getAllFiles(taskDownloadDir);
    let uploadedCount = 0;
    const totalFiles = files.length;
    let totalSize = 0;
    files.forEach(f => totalSize += fs.statSync(f).size);
    let uploadedSize = 0;

    for (const file of files) {
      const relPath = path.relative(taskDownloadDir, file);
      const remoteFileDir = path.join(uploadPath, path.dirname(relPath));
      if (remoteFileDir !== uploadPath) {
          await createDirOpenlist(olUrl, token, remoteFileDir);
      }
      
      const fileSize = fs.statSync(file).size;
      await uploadToOpenlist(olUrl, token, file, remoteFileDir, () => {
          // Inner progress not easily captured here without modifying openlist.ts, 
          // but we can update per file
      });
      
      uploadedCount++;
      uploadedSize += fileSize;
      updateTaskStatus(taskId, {
          uploadStats: {
              totalFiles,
              uploadedFiles: uploadedCount,
              percent: Math.round((uploadedSize / totalSize) * 100),
              currentFile: path.basename(file),
              transferred: formatSize(uploadedSize),
              total: formatSize(totalSize)
          }
      });
    }
    return;
  }

  const rcloneConfigPath = await createRcloneConfig(taskId, service, params as unknown as Record<string, unknown>);
  if (!rcloneConfigPath) throw new Error(`Failed to generate Rclone config for ${service}`);
  
  try {
      const remoteDest = `${service}:${uploadPath}`;
      await runCommand(taskId, 'rclone', ['copy', '--config', rcloneConfigPath, taskDownloadDir, remoteDest, '-P'], statusFile);
  } finally {
      if (fs.existsSync(rcloneConfigPath)) fs.unlinkSync(rcloneConfigPath);
  }
}

async function executeJob(taskId: string, params: TaskParams) {
  const { url, downloader: initialDownloader, upload_service: uploadService, upload_path: uploadPath, enable_compression: enableCompression, split_compression: splitCompression, split_size: splitSize, createdBy } = params;
  const statusFile = path.join(STATUS_DIR, `${taskId}.log`);
  const uploadLogFile = path.join(STATUS_DIR, `${taskId}_upload.log`);
  const taskDownloadDir = path.join(DOWNLOADS_DIR, taskId);
  const taskGdlConfigPath = path.join(STATUS_DIR, `${taskId}_gdl.json`);
  
  let tempCookieFile: string | null = null;
  let archivePaths: string[] = [];
  const downloader = initialDownloader;

  try {
    const useCompression = enableCompression === 'true' || enableCompression === true;
    const useSplit = splitCompression === 'true' || splitCompression === true;
    const sSize = parseInt(String(splitSize || 1000));

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

    // Auto-switch to kemono-dl for certain sites if uncompressed
    const isKemonoSite = /kemono\.(cr|su)|coomer\.(st|su)/.test(url);
    if (downloader === 'kemono-dl' || (isKemonoSite && !useCompression)) {
        const actualDownloader = 'kemono-dl';
        const kemonoUser = params.kemono_username || await dbConfig.getConfig('WDM_KEMONO_USERNAME');
        const kemonoPass = params.kemono_password || await dbConfig.getConfig('WDM_KEMONO_PASSWORD');
        
        const args = ['-m', actualDownloader, '--path', taskDownloadDir, url];
        args.push('--output', '{service}/{creator_name}/{post_title}/{filename}');

        if (params.cookies) {
          tempCookieFile = createNetscapeCookies(params.cookies);
          args.push('--cookies', tempCookieFile);
        } else if (kemonoUser && kemonoPass) {
          args.push('--kemono-login', kemonoUser, kemonoPass);
        }
        
        await runCommand(taskId, 'python3', args, statusFile);

        if (!useCompression) {
            updateTaskStatus(taskId, { status: 'uploading' });
            await uploadUncompressed(taskId, uploadService, uploadPath, params, uploadLogFile);
            updateTaskStatus(taskId, { status: 'completed' });
            return;
        }
    } else if (downloader === 'megadl') {
      const args = ['--path', taskDownloadDir, url];
      await runCommand(taskId, 'megadl', args, statusFile);
    } else {
      // Gallery-dl logic
      const gdlConfigData = {
          extractor: {
              "base-directory": taskDownloadDir,
              directory: params.kemono_path_template === 'true' ? ["{user}", "{title}"] : ["{service}", "{user}", "{id}"]
          }
      };
      fs.writeFileSync(taskGdlConfigPath, JSON.stringify(gdlConfigData, null, 2));

      const args = ['--verbose', '-c', taskGdlConfigPath];
      if (params.cookies) {
        tempCookieFile = createNetscapeCookies(params.cookies);
        args.push('--cookies', tempCookieFile);
      }
      if (params.kemono_posts) args.push('-o', `extractor.kemono.posts=${params.kemono_posts}`);
      if (params.kemono_revisions === 'true') args.push('-o', 'extractor.kemono.revisions=true');
      if (params.pixiv_ugoira === 'false') args.push('-o', 'extractor.pixiv.ugoira=false');

      const kemonoUser = await dbConfig.getConfig('WDM_KEMONO_USERNAME');
      const kemonoPass = await dbConfig.getConfig('WDM_KEMONO_PASSWORD');
      if (kemonoUser && kemonoPass) {
          args.push('-o', `extractor.kemono.username=${kemonoUser}`, '-o', `extractor.kemono.password=${kemonoPass}`);
      }

      const extraArgs = await dbConfig.getConfig('WDM_GALLERY_DL_ARGS');
      if (extraArgs) args.push(...extraArgs.split(' '));

      args.push(url);
      await runCommand(taskId, 'gallery-dl', args, statusFile);
    }

    // --- 2. Compression Logic ---
    if (useCompression) {
      updateTaskStatus(taskId, { status: 'compressing' });
      const archiveNameBase = `archive_${taskId}`;
      
      if (useSplit) {
          archivePaths = await compressInChunks(taskId, taskDownloadDir, archiveNameBase, sSize, statusFile);
      } else {
          const archivePath = path.join(ARCHIVES_DIR, `${archiveNameBase}.tar.zst`);
          await runCommand(taskId, 'sh', ['-c', `tar -cf - -C "${taskDownloadDir}" . | zstd -o "${archivePath}"`], statusFile);
          archivePaths.push(archivePath);
      }
    } else {
        updateTaskStatus(taskId, { status: 'uploading' });
        await uploadUncompressed(taskId, uploadService, uploadPath, params, uploadLogFile);
        updateTaskStatus(taskId, { status: 'completed' });
        return;
    }

    // --- 3. Upload Logic ---
    updateTaskStatus(taskId, { status: 'uploading' });
    const totalUploadFiles = archivePaths.length;
    let uploadedCount = 0;

    updateTaskStatus(taskId, {
        uploadStats: {
            totalFiles: totalUploadFiles,
            uploadedFiles: 0,
            percent: 0
        }
    });

    if (uploadService === 'gofile') {
      const token = params.gofile_token || await dbConfig.getConfig('WDM_GOFILE_TOKEN');
      const folderId = params.gofile_folder_id || await dbConfig.getConfig('WDM_GOFILE_FOLDER_ID');
      
      for (const file of archivePaths) {
        const link = await uploadToGofile(file, token || undefined, folderId || undefined, (msg) => fs.appendFileSync(uploadLogFile, msg + '\n'));
        uploadedCount++;
        updateTaskStatus(taskId, { 
            gofileLink: link,
            uploadStats: {
                totalFiles: totalUploadFiles,
                uploadedFiles: uploadedCount,
                percent: Math.round((uploadedCount / totalUploadFiles) * 100)
            }
        });
      }
    } else if (uploadService === 'openlist') {
      const olUrl = params.openlist_url || await dbConfig.getConfig('WDM_OPENLIST_URL');
      const olUser = params.openlist_user || await dbConfig.getConfig('WDM_OPENLIST_USER');
      const olPass = params.openlist_pass || await dbConfig.getConfig('WDM_OPENLIST_PASS');
      
      if (!olUrl || !olUser || !olPass) throw new Error('Openlist credentials missing');
      
      const token = await loginOpenlist(olUrl, olUser, olPass);
      await createDirOpenlist(olUrl, token, uploadPath);
      
      let totalSize = 0;
      archivePaths.forEach(f => totalSize += fs.statSync(f).size);
      let uploadedSize = 0;

      for (const file of archivePaths) {
        const fileSize = fs.statSync(file).size;
        await uploadToOpenlist(olUrl, token, file, uploadPath);
        uploadedCount++;
        uploadedSize += fileSize;
        updateTaskStatus(taskId, {
            uploadStats: {
                totalFiles: totalUploadFiles,
                uploadedFiles: uploadedCount,
                percent: Math.round((uploadedSize / totalSize) * 100),
                transferred: formatSize(uploadedSize),
                total: formatSize(totalSize)
            }
        });
      }
    } else {
      const rcloneConfigPath = await createRcloneConfig(taskId, uploadService, params as unknown as Record<string, unknown>);
      if (!rcloneConfigPath) throw new Error(`Failed to generate Rclone config for ${uploadService}`);
      
      try {
          for (const file of archivePaths) {
            const remoteDest = `${uploadService}:${uploadPath}/${path.basename(file)}`;
            await runCommand(taskId, 'rclone', ['copyto', '--config', rcloneConfigPath, file, remoteDest, '-P'], uploadLogFile);
            uploadedCount++;
            updateTaskStatus(taskId, {
                uploadStats: {
                    totalFiles: totalUploadFiles,
                    uploadedFiles: uploadedCount,
                    percent: Math.round((uploadedCount / totalUploadFiles) * 100)
                }
            });
          }
      } finally {
          if (fs.existsSync(rcloneConfigPath)) fs.unlinkSync(rcloneConfigPath);
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
    // Cleanup
    if (tempCookieFile && fs.existsSync(tempCookieFile)) fs.unlinkSync(tempCookieFile);
    if (fs.existsSync(taskGdlConfigPath)) fs.unlinkSync(taskGdlConfigPath);
    if (fs.existsSync(taskDownloadDir)) {
        try {
            fs.rmSync(taskDownloadDir, { recursive: true, force: true });
        } catch (e) {
            logger.error(`Failed to cleanup download dir ${taskDownloadDir}: ${e}`);
        }
    }
    for (const archivePath of archivePaths) {
        if (fs.existsSync(archivePath)) fs.unlinkSync(archivePath);
    }
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



export function killTask(taskId: string): boolean {

  const child = activeProcesses.get(taskId);

  if (child) {

    child.kill('SIGKILL');

    activeProcesses.delete(taskId);

    updateTaskStatus(taskId, { status: 'failed', error: 'Task killed by user' });

    return true;

  }

  return false;

}



export function pauseTask(taskId: string): boolean {

  const child = activeProcesses.get(taskId);

  if (child) {

    child.kill('SIGSTOP');

    updateTaskStatus(taskId, { status: 'paused' });

    return true;

  }

  return false;

}



export function resumeTask(taskId: string): boolean {

  const child = activeProcesses.get(taskId);

  if (child) {

    child.kill('SIGCONT');

    updateTaskStatus(taskId, { status: 'running' });

    return true;

  }

  return false;

}



export async function retryTask(taskId: string, username: string): Promise<string | null> {

  const statusPath = getTaskStatusPath(taskId);

  if (!fs.existsSync(statusPath)) return null;

  

  const statusData: TaskStatus = JSON.parse(fs.readFileSync(statusPath, 'utf8'));

  const originalParams = statusData.originalParams;

  if (!originalParams) return null;



  const newTaskId = `retry_${taskId}_${Date.now()}`;

  await processDownloadJob(newTaskId, { ...originalParams, createdBy: username });

  return newTaskId;

}
