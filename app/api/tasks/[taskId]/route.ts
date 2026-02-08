import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getTaskStatusPath, killTask, pauseTask, resumeTask, retryTask } from '@/lib/tasks';
import { STATUS_DIR } from '@/lib/constants';
import fs from 'fs';
import path from 'path';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const statusPath = getTaskStatusPath(taskId);
  const downloadLogPath = path.join(STATUS_DIR, `${taskId}.log`);
  const uploadLogPath = path.join(STATUS_DIR, `${taskId}_upload.log`);
  const oauthLogPath = path.join(STATUS_DIR, `oauth_${taskId}.log`);

  if (!fs.existsSync(statusPath)) {
    return NextResponse.json({ error: '任务不存在', message: 'Task not found' }, { status: 404 });
  }

  let statusData: Record<string, unknown> = {};
  try {
    statusData = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
  } catch (e) {
    return NextResponse.json({ error: '无效的状态文件', message: 'Invalid status file', detail: String(e) }, { status: 500 });
  }

  let downloadLog = '';
  if (fs.existsSync(downloadLogPath)) {
    downloadLog = fs.readFileSync(downloadLogPath, 'utf8');
  }

  let uploadLog = '';
  if (fs.existsSync(uploadLogPath)) {
    uploadLog = fs.readFileSync(uploadLogPath, 'utf8');
  }

  let oauthLog = '';
  if (fs.existsSync(oauthLogPath)) {
    oauthLog = fs.readFileSync(oauthLogPath, 'utf8');
  }

  // Parse rclone progress from upload_log
  const progressData = (statusData.uploadStats as Record<string, unknown>) || {};
  if (uploadLog && uploadLog.includes('Transferred:')) {
    const lines = uploadLog.split('\n');
    for (const line of lines) {
      if (line.includes('Transferred:')) {
        const idx = line.indexOf('%');
        if (idx > -1) {
          const percent = line.slice(Math.max(0, idx - 2), idx).trim();
          if (percent && /^\d+$/.test(percent)) {
            progressData.percent = parseInt(percent, 10);
          }
        }
        const parts = line.split(/\s+/);
        if (parts.length > 4) {
          progressData.transferred = `${parts[1]} ${parts[2]}`;
          progressData.total = `${parts[4]} ${parts[5]}`;
        }
      }
    }
  }

  return NextResponse.json({
    success: true,
    status: statusData,
    logs: {
      download: downloadLog,
      upload: uploadLog,
      oauth: oauthLog
    },
    progress: progressData
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const statusPath = getTaskStatusPath(taskId);
  if (!fs.existsSync(statusPath)) {
    return NextResponse.json({ error: '任务不存在', message: 'Task not found' }, { status: 404 });
  }

  try {
    const { action } = await request.json();

    switch (action) {
      case 'kill':
      case 'delete':
      case 'cancel': {
        const result = killTask(taskId);
        return NextResponse.json({
          success: result,
          message: result ? '任务已取消' : '取消任务失败',
        });
      }
      case 'pause': {
        const result = pauseTask(taskId);
        return NextResponse.json({
          success: result,
          message: result ? '任务已暂停' : '暂停任务失败',
        });
      }
      case 'resume': {
        const result = resumeTask(taskId);
        return NextResponse.json({
          success: result,
          message: result ? '任务已恢复' : '恢复任务失败',
        });
      }
      case 'retry': {
        const newId = await retryTask(taskId, user.username);
        return NextResponse.json({
          success: !!newId,
          message: newId ? '任务已重试' : '重试任务失败',
          newTaskId: newId
        });
      }
      default:
        return NextResponse.json({ error: '无效的操作', message: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Task action error:', error);
    return NextResponse.json(
      { error: '操作失败', message: 'Operation failed', detail: String(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const statusPath = getTaskStatusPath(taskId);
  const downloadLogPath = path.join(STATUS_DIR, `${taskId}.log`);
  const uploadLogPath = path.join(STATUS_DIR, `${taskId}_upload.log`);
  const oauthLogPath = path.join(STATUS_DIR, `oauth_${taskId}.log`);

  let deleted = false;

  try {
    if (fs.existsSync(statusPath)) {
      fs.unlinkSync(statusPath);
      deleted = true;
    }
    if (fs.existsSync(downloadLogPath)) {
      fs.unlinkSync(downloadLogPath);
    }
    if (fs.existsSync(uploadLogPath)) {
      fs.unlinkSync(uploadLogPath);
    }
    if (fs.existsSync(oauthLogPath)) {
      fs.unlinkSync(oauthLogPath);
    }

    return NextResponse.json({
      success: deleted,
      message: deleted ? '任务已删除' : '任务不存在'
    });
  } catch (error) {
    console.error('Task deletion error:', error);
    return NextResponse.json(
      { error: '删除失败', message: 'Failed to delete task', detail: String(error) },
      { status: 500 }
    );
  }
}