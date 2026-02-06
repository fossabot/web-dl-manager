import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { updateTaskStatus, processDownloadJob, TaskStatus, TaskParams } from '@/lib/tasks';
import { STATUS_DIR } from '@/lib/constants';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tasks: TaskStatus[] = [];
  if (fs.existsSync(STATUS_DIR)) {
    const files = fs.readdirSync(STATUS_DIR);
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const content = fs.readFileSync(path.join(STATUS_DIR, file), 'utf8');
          tasks.push(JSON.parse(content));
        } catch {
          // Ignore corrupted files
        }
      }
    }
  }

  // Sort by createdAt descending
  tasks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return NextResponse.json(tasks);
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await request.formData();
  const url = formData.get('url') as string;
  const downloader = (formData.get('downloader') as string) || 'gallery-dl';
  const uploadService = formData.get('upload_service') as string;
  const uploadPath = formData.get('upload_path') as string;
  const enableCompression = formData.get('enable_compression') as string;
  const splitCompression = formData.get('split_compression') === 'true';
  const splitSize = parseInt(formData.get('split_size') as string) || 1000;

  if (!url || !uploadService) {
    return NextResponse.json({ error: 'URL and Upload Service are required' }, { status: 400 });
  }

  const urls = url.split('\n').map(u => u.trim()).filter(u => u);
  const taskIds: string[] = [];

  for (const singleUrl of urls) {
    const taskId = uuidv4();
    taskIds.push(taskId);

    const params: TaskParams = {
      url: singleUrl,
      downloader,
      upload_service: uploadService,
      upload_path: uploadPath,
      enable_compression: enableCompression,
      split_compression: splitCompression,
      split_size: splitSize,
      createdBy: user.username
    };

    updateTaskStatus(taskId, {
      id: taskId,
      status: 'queued',
      url: singleUrl,
      downloader,
      uploadService,
      uploadPath,
      createdAt: new Date().toISOString(),
      createdBy: user.username,
      originalParams: params
    });

    // Start background job
    processDownloadJob(taskId, params);
  }

  return NextResponse.json({ success: true, taskIds });
}