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

  if (!fs.existsSync(statusPath)) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }

  const statusData = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
  
  let downloadLog = '';
  if (fs.existsSync(downloadLogPath)) {
    downloadLog = fs.readFileSync(downloadLogPath, 'utf8');
  }

  let uploadLog = '';
  if (fs.existsSync(uploadLogPath)) {
    uploadLog = fs.readFileSync(uploadLogPath, 'utf8');
  }

  return NextResponse.json({
    status: statusData,
    downloadLog,
    uploadLog,
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

  const { action } = await request.json();

  switch (action) {
    case 'kill':
      return NextResponse.json({ success: killTask(taskId) });
    case 'pause':
      return NextResponse.json({ success: pauseTask(taskId) });
    case 'resume':
      return NextResponse.json({ success: resumeTask(taskId) });
    case 'retry':
      const newId = await retryTask(taskId, user.username);
      return NextResponse.json({ success: !!newId, newTaskId: newId });
    default:
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
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

  if (fs.existsSync(statusPath)) fs.unlinkSync(statusPath);
  if (fs.existsSync(downloadLogPath)) fs.unlinkSync(downloadLogPath);
  if (fs.existsSync(uploadLogPath)) fs.unlinkSync(uploadLogPath);

  return NextResponse.json({ success: true });
}