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

  try {
    const formData = await request.formData();
    const url = formData.get('url') as string;
    const downloader = (formData.get('downloader') as string) || 'gallery-dl';
    const uploadService = formData.get('upload_service') as string;
    const uploadPath = formData.get('upload_path') as string;
    const enableCompression = formData.get('enable_compression') as string;
    const splitCompression = formData.get('split_compression') === 'true';
    const splitSize = parseInt(formData.get('split_size') as string) || 1000;

    // Site Specific Options
    const kemonoPosts = formData.get('kemono_posts') ? parseInt(formData.get('kemono_posts') as string) : undefined;
    const kemonoRevisions = formData.get('kemono_revisions') as string;
    const kemonoPathTemplate = formData.get('kemono_path_template') as string;
    const pixivUgoira = (formData.get('pixiv_ugoira') as string) || 'true';

    // Validation
    if (!url || !uploadService) {
      return NextResponse.json(
        { error: 'URL 和上传服务是必需的', message: 'URL and Upload Service are required' },
        { status: 400 }
      );
    }

    if (uploadService !== 'gofile' && !uploadPath) {
      return NextResponse.json(
        { error: '此服务需要上传路径', message: 'Upload Path is required for this service' },
        { status: 400 }
      );
    }

    const urls = url.split('\n').map(u => u.trim()).filter(u => u);
    if (urls.length === 0) {
      return NextResponse.json(
        { error: '没有有效的 URL', message: 'No valid URLs provided' },
        { status: 400 }
      );
    }

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
        createdBy: user.username,
        kemono_posts: kemonoPosts,
        kemono_revisions: kemonoRevisions,
        kemono_path_template: kemonoPathTemplate,
        pixiv_ugoira: pixivUgoira,
        cookies: formData.get('cookies') as string,
        gofile_token: formData.get('gofile_token') as string,
        gofile_folder_id: formData.get('gofile_folder_id') as string,
        openlist_url: formData.get('openlist_url') as string,
        openlist_user: formData.get('openlist_user') as string,
        openlist_pass: formData.get('openlist_pass') as string,
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

    return NextResponse.json({
      success: true,
      message: `成功启动 ${taskIds.length} 个任务`,
      taskIds
    });
  } catch (error) {
    console.error('Task creation error:', error);
    return NextResponse.json(
      { error: '任务创建失败', message: 'Failed to create task' },
      { status: 500 }
    );
  }
}