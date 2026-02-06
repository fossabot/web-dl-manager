import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { STATUS_DIR, DOWNLOADS_DIR, ARCHIVES_DIR } from './constants';
import { dbConfig } from './config';

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
  originalParams?: any;
}

const activeProcesses = new Map<string, ChildProcess>();

export function getTaskStatusPath(taskId: string): string {
  return path.join(STATUS_DIR, `${taskId}.json`);
}

export function updateTaskStatus(taskId: string, updates: Partial<TaskStatus>) {
  const statusPath = getTaskStatusPath(taskId);
  let statusData: any = {};
  if (fs.existsSync(statusPath)) {
    try {
      statusData = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
    } catch (e) {
      // Ignore
    }
  }
  statusData = { ...statusData, ...updates, id: taskId };
  fs.writeFileSync(statusPath, JSON.stringify(statusData, null, 2));
}

export async function runCommand(
  taskId: string,
  command: string,
  args: string[],
  logFile: string,
  env: Record<string, string> = {}
): Promise<number> {
  return new Promise((resolve, reject) => {
    const logStream = fs.createWriteStream(logFile, { flags: 'a' });
    logStream.write(`
[Executing] ${command} ${args.join(' ')}
`);

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
      if (code === 0) {
        resolve(code);
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });

    child.on('error', (err) => {
      activeProcesses.delete(taskId);
      reject(err);
    });
  });
}

export async function processDownloadJob(taskId: string, params: any) {
  const { url, downloader, uploadService, uploadPath, enableCompression, splitCompression, splitSize, createdBy } = params;
  const statusFile = path.join(STATUS_DIR, `${taskId}.log`);
  const uploadLogFile = path.join(STATUS_DIR, `${taskId}_upload.log`);
  const taskDownloadDir = path.join(DOWNLOADS_DIR, taskId);

  try {
    updateTaskStatus(taskId, { status: 'running', url, downloader, uploadService, uploadPath, createdAt: new Date().toISOString(), createdBy });
    fs.writeFileSync(statusFile, `Starting job ${taskId} for URL: ${url}
`);

    if (!fs.existsSync(taskDownloadDir)) {
      fs.mkdirSync(taskDownloadDir, { recursive: true });
    }

    // Gallery-dl implementation
    let command = 'gallery-dl';
    let args = ['--verbose', '--directory', taskDownloadDir];
    
    // Add more gallery-dl args based on params...
    // For now, simple implementation
    args.push(url);

    await runCommand(taskId, command, args, statusFile);

    if (enableCompression === 'true') {
      updateTaskStatus(taskId, { status: 'compressing' });
      const archiveName = `archive_${taskId}.tar.zst`;
      const archivePath = path.join(ARCHIVES_DIR, archiveName);
      
      // tar -cf - -C source . | zstd -o archive
      await runCommand(taskId, 'tar', ['-cf', '-', '-C', taskDownloadDir, '.', '|', 'zstd', '-o', archivePath], statusFile);
      
      updateTaskStatus(taskId, { status: 'uploading' });
      // Upload implementation...
    } else {
      updateTaskStatus(taskId, { status: 'uploading' });
      // Upload uncompressed...
    }

    updateTaskStatus(taskId, { status: 'completed' });
  } catch (error: any) {
    updateTaskStatus(taskId, { status: 'failed', error: error.message });
    fs.appendFileSync(statusFile, `
--- JOB FAILED ---
${error.message}
`);
  } finally {
    // Cleanup
    if (fs.existsSync(taskDownloadDir)) {
      // fs.rmSync(taskDownloadDir, { recursive: true, force: true });
    }
  }
}
