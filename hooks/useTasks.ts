'use client';

import { useState, useCallback } from 'react';
import { message } from 'antd';

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
}

export function useTasks() {
  const [loading, setLoading] = useState(false);

  // 创建新任务
  const createTask = useCallback(async (formData: FormData) => {
    setLoading(true);
    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        message.error(data.error || '任务创建失败');
        return { success: false, data };
      }

      message.success(data.message || `成功启动 ${data.taskIds?.length || 0} 个任务`);
      return { success: true, data };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '任务创建失败';
      message.error(errorMsg);
      return { success: false, error: err };
    } finally {
      setLoading(false);
    }
  }, []);

  // 获取单个任务详情
  const getTaskDetail = useCallback(async (taskId: string) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}`);
      const data = await response.json();

      if (!response.ok) {
        message.error(data.error || '获取任务详情失败');
        return null;
      }

      return data;
    } catch (err) {
      console.error('Failed to get task detail:', err);
      message.error('获取任务详情失败');
      return null;
    }
  }, []);

  // 暂停任务
  const pauseTask = useCallback(async (taskId: string) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pause' }),
      });

      const data = await response.json();

      if (data.success) {
        message.success(data.message || '任务已暂停');
      } else {
        message.error(data.message || '暂停任务失败');
      }

      return data;
    } catch (err) {
      console.error('Failed to pause task:', err);
      message.error('暂停任务失败');
      return { success: false };
    }
  }, []);

  // 恢复任务
  const resumeTask = useCallback(async (taskId: string) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resume' }),
      });

      const data = await response.json();

      if (data.success) {
        message.success(data.message || '任务已恢复');
      } else {
        message.error(data.message || '恢复任务失败');
      }

      return data;
    } catch (err) {
      console.error('Failed to resume task:', err);
      message.error('恢复任务失败');
      return { success: false };
    }
  }, []);

  // 重试任务
  const retryTask = useCallback(async (taskId: string) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'retry' }),
      });

      const data = await response.json();

      if (data.success) {
        message.success(data.message || '任务已重试');
      } else {
        message.error(data.message || '重试任务失败');
      }

      return data;
    } catch (err) {
      console.error('Failed to retry task:', err);
      message.error('重试任务失败');
      return { success: false };
    }
  }, []);

  // 取消/删除任务
  const cancelTask = useCallback(async (taskId: string) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'kill' }),
      });

      const data = await response.json();

      if (data.success) {
        message.success(data.message || '任务已取消');
      } else {
        message.error(data.message || '取消任务失败');
      }

      return data;
    } catch (err) {
      console.error('Failed to cancel task:', err);
      message.error('取消任务失败');
      return { success: false };
    }
  }, []);

  // 删除任务
  const deleteTask = useCallback(async (taskId: string) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        message.success(data.message || '任务已删除');
      } else {
        message.error(data.message || '删除任务失败');
      }

      return data;
    } catch (err) {
      console.error('Failed to delete task:', err);
      message.error('删除任务失败');
      return { success: false };
    }
  }, []);

  return {
    loading,
    createTask,
    getTaskDetail,
    pauseTask,
    resumeTask,
    retryTask,
    cancelTask,
    deleteTask,
  };
}
