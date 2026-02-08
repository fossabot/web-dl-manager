'use client';

import { useState, useEffect } from 'react';
import { message } from 'antd';
import { RefreshCw, Trash2, Pause, Play, RotateCcw } from 'lucide-react';
import { useTasks } from '@/hooks/useTasks';

interface Task {
  id: string;
  url: string;
  status: string;
  progress?: number;
  createdAt: string;
  updatedAt: string;
}

interface TableTask extends Task {
  key: string;
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<TableTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [searchText, setSearchText] = useState('');
  const { pauseTask, resumeTask, retryTask, cancelTask, deleteTask } = useTasks();

  const fetchTasks = async (): Promise<void> => {
    setLoading(true);
    try {
      const res = await fetch('/api/tasks');
      if (res.ok) {
        const data = await res.json();
        setTasks(data.map((task: Task) => ({ ...task, key: task.id })));
      }
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
      message.error('加载任务失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 5000);
    return () => {
      clearInterval(interval);
    };
  }, []);

  const getStatusColor = (status: string): string => {
    const colorMap: Record<string, string> = {
      downloading: '#3b82f6',
      running: '#3b82f6',
      completed: '#10b981',
      failed: '#ef4444',
      queued: '#8b5cf6',
      paused: '#f59e0b',
      compressing: '#3b82f6',
      uploading: '#3b82f6',
    };
    return colorMap[status] || '#6b7280';
  };

  const getStatusLabel = (status: string): string => {
    const labelMap: Record<string, string> = {
      downloading: '下载中',
      running: '运行中',
      completed: '已完成',
      failed: '失败',
      queued: '等待中',
      paused: '已暂停',
      compressing: '压缩中',
      uploading: '上传中',
    };
    return labelMap[status] || status;
  };

  const filteredTasks = tasks.filter((task) => {
    const matchesStatus = !statusFilter || task.status === statusFilter;
    const matchesSearch = !searchText || task.url.toLowerCase().includes(searchText.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const stats = {
    total: tasks.length,
    completed: tasks.filter((t) => t.status === 'completed').length,
    downloading: tasks.filter((t) => t.status === 'downloading' || t.status === 'running').length,
    failed: tasks.filter((t) => t.status === 'failed').length,
  };

  const handlePause = async (taskId: string) => {
    await pauseTask(taskId);
    await fetchTasks();
  };

  const handleResume = async (taskId: string) => {
    await resumeTask(taskId);
    await fetchTasks();
  };

  const handleRetry = async (taskId: string) => {
    await retryTask(taskId);
    await fetchTasks();
  };

  const handleCancel = (taskId: string) => {
    if (confirm('确定要取消此任务吗？')) {
      cancelTask(taskId)
        .then(() => fetchTasks())
        .catch((err) => {
          console.error('Failed to cancel task:', err);
        });
    }
  };

  const handleDelete = (taskId: string) => {
    if (confirm('确定要删除此任务吗？此操作不可恢复。')) {
      deleteTask(taskId)
        .then(() => fetchTasks())
        .catch((err) => {
          console.error('Failed to delete task:', err);
        });
    }
  };

  const StatCard = ({ title, value, color }: { title: string; value: number; color: string }) => (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4 shadow-sm">
      <p className="text-sm font-medium text-slate-400">{title}</p>
      <p className="mt-2 text-3xl font-bold" style={{ color }}>
        {value}
      </p>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="space-y-6">
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
          <StatCard title="总任务数" value={stats.total} color="#9ca3af" />
          <StatCard title="已完成" value={stats.completed} color="#10b981" />
          <StatCard title="进行中" value={stats.downloading} color="#3b82f6" />
          <StatCard title="失败" value={stats.failed} color="#ef4444" />
        </div>

        {/* Search & Filter */}
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <input
              type="text"
              placeholder="搜索下载链接..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-slate-100 placeholder-slate-500 transition-colors hover:border-slate-600 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />

            <select
              value={statusFilter || ''}
              onChange={(e) => setStatusFilter(e.target.value || undefined)}
              className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-slate-100 transition-colors hover:border-slate-600 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="">按状态过滤</option>
              <option value="running">运行中</option>
              <option value="downloading">下载中</option>
              <option value="completed">已完成</option>
              <option value="failed">失败</option>
              <option value="queued">等待中</option>
              <option value="paused">已暂停</option>
            </select>

            <button
              onClick={fetchTasks}
              disabled={loading}
              className="flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-blue-600/20 px-4 py-2 font-medium text-blue-400 transition-colors hover:bg-blue-600/30 disabled:opacity-50"
            >
              <RefreshCw size={18} />
              刷新
            </button>
          </div>
        </div>

        {/* Tasks Table */}
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-800/30">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">任务 ID</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">下载链接</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">状态</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-slate-300">进度</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">创建时间</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-slate-300">操作</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                      加载中...
                    </td>
                  </tr>
                )}
                {!loading && filteredTasks.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                      没有任务
                    </td>
                  </tr>
                )}
                {!loading && filteredTasks.length > 0 && filteredTasks.map((task) => (
                  <tr key={task.key} className="border-b border-slate-800 hover:bg-slate-800/20 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-slate-400">{task.id.slice(0, 8)}</td>
                      <td className="px-4 py-3 max-w-xs truncate text-sm text-slate-300" title={task.url}>
                        {task.url}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-block px-3 py-1 rounded-full text-xs font-medium text-white"
                          style={{ backgroundColor: `${getStatusColor(task.status)}30`, color: getStatusColor(task.status) }}
                        >
                          {getStatusLabel(task.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-slate-400">{task.progress || 0}%</td>
                      <td className="px-4 py-3 text-sm text-slate-400">
                        {new Date(task.createdAt).toLocaleString('zh-CN')}
                      </td>
                      <td className="px-4 py-3 flex justify-end gap-2">
                        {(task.status === 'running' || task.status === 'downloading') && (
                          <button
                            onClick={() => handlePause(task.id)}
                            title="暂停任务"
                            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
                          >
                            <Pause size={16} />
                          </button>
                        )}

                        {task.status === 'paused' && (
                          <button
                            onClick={() => handleResume(task.id)}
                            title="恢复任务"
                            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
                          >
                            <Play size={16} />
                          </button>
                        )}

                        {(task.status === 'failed' || task.status === 'completed') && (
                          <button
                            onClick={() => handleRetry(task.id)}
                            title="重试任务"
                            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
                          >
                            <RotateCcw size={16} />
                          </button>
                        )}

                        {(task.status === 'queued' || task.status === 'running' || task.status === 'downloading') && (
                          <button
                            onClick={() => handleCancel(task.id)}
                            title="取消任务"
                            className="p-2 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg transition-colors"
                          >
                            ✕
                          </button>
                        )}

                        <button
                          onClick={() => handleDelete(task.id)}
                          title="删除任务记录"
                          className="p-2 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Pagination info */}
          {!loading && filteredTasks.length > 0 && (
            <div className="border-t border-slate-800 px-4 py-3 text-sm text-slate-400">
              共 {filteredTasks.length} 个任务
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
