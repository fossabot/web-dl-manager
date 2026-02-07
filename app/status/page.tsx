'use client';

import { useState, useEffect } from 'react';
import { message } from 'antd';
import { Activity, BarChart3, Zap, RefreshCw, Loader } from 'lucide-react';

interface Task {
  id: string;
  url: string;
  status: string;
  createdAt: string;
}

interface SystemStats {
  totalTasks: number;
  completedTasks: number;
  runningTasks: number;
  failedTasks: number;
}

export default function StatusPage() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const tasksRes = await fetch('/api/tasks');
      if (tasksRes.ok) {
        const tasksData = await tasksRes.json();
        setTasks(tasksData);

        const totalTasks = tasksData.length;
        const completedTasks = tasksData.filter((t: Task) => t.status === 'completed').length;
        const runningTasks = tasksData.filter((t: Task) => t.status === 'downloading').length;
        const failedTasks = tasksData.filter((t: Task) => t.status === 'failed').length;

        setStats({
          totalTasks,
          completedTasks,
          runningTasks,
          failedTasks,
        });
      }
    } catch (err) {
      console.error('Failed to fetch system status:', err);
      message.error('无法获取系统状态');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      downloading: '#f59e0b',
      completed: '#22c55e',
      failed: '#ef4444',
      queued: '#64748b',
      paused: '#f59e0b',
      compressing: '#3b82f6',
      uploading: '#3b82f6',
    };
    return colors[status] || '#64748b';
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      downloading: '下载中',
      completed: '已完成',
      failed: '失败',
      queued: '等待中',
      paused: '已暂停',
      compressing: '压缩中',
      uploading: '上传中',
    };
    return labels[status] || status;
  };

  if (loading && !stats) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <Loader size={48} className="text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-slate-400">加载系统状态中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="container-responsive max-w-7xl mx-auto pt-8 pb-20 md:pt-12 md:pb-12">
        {/* 标题区 */}
        <div className="flex items-center justify-between mb-12 flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <Activity size={32} className="text-blue-600" />
            <h1 className="text-3xl md:text-4xl font-bold text-white">系统状态</h1>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="btn-primary flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
            刷新
          </button>
        </div>

        {/* 统计卡片网格 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-12">
          {/* 总任务数 */}
          <div className="card-elevated p-4 md:p-6 text-center hover:shadow-lg transition-shadow">
            <div className="text-slate-400 text-xs md:text-sm mb-2 flex items-center justify-center gap-1">
              <BarChart3 size={16} />
              <span>总任务数</span>
            </div>
            <div className="text-3xl md:text-4xl font-bold text-white">
              {stats?.totalTasks || 0}
            </div>
          </div>

          {/* 已完成 */}
          <div className="card-elevated p-4 md:p-6 text-center border border-green-500/30 hover:shadow-lg transition-shadow">
            <div className="text-green-400 text-xs md:text-sm mb-2 flex items-center justify-center gap-1">
              <Activity size={16} />
              <span>已完成</span>
            </div>
            <div className="text-3xl md:text-4xl font-bold text-green-400">
              {stats?.completedTasks || 0}
            </div>
          </div>

          {/* 运行中 */}
          <div className="card-elevated p-4 md:p-6 text-center border border-yellow-500/30 hover:shadow-lg transition-shadow">
            <div className="text-yellow-400 text-xs md:text-sm mb-2 flex items-center justify-center gap-1">
              <Zap size={16} />
              <span>运行中</span>
            </div>
            <div className="text-3xl md:text-4xl font-bold text-yellow-400">
              {stats?.runningTasks || 0}
            </div>
          </div>

          {/* 失败 */}
          <div className="card-elevated p-4 md:p-6 text-center border border-red-500/30 hover:shadow-lg transition-shadow">
            <div className="text-red-400 text-xs md:text-sm mb-2 flex items-center justify-center gap-1">
              <Activity size={16} />
              <span>失败</span>
            </div>
            <div className="text-3xl md:text-4xl font-bold text-red-400">
              {stats?.failedTasks || 0}
            </div>
          </div>
        </div>

        {/* 任务列表 */}
        <div className="card-elevated p-4 md:p-6">
          <h2 className="text-xl md:text-2xl font-semibold text-white mb-6">近期任务</h2>

          {tasks.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-400">暂无任务</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm md:text-base">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-3 px-3 md:px-4 text-slate-300 font-semibold">URL</th>
                    <th className="text-left py-3 px-3 md:px-4 text-slate-300 font-semibold">状态</th>
                    <th className="text-left py-3 px-3 md:px-4 text-slate-300 font-semibold">创建时间</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.slice(0, 10).map((task) => (
                    <tr
                      key={task.id}
                      className="border-b border-slate-800 hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="py-3 px-3 md:px-4 text-slate-300 truncate max-w-xs md:max-w-sm lg:max-w-xl">
                        <span title={task.url}>{task.url}</span>
                      </td>
                      <td className="py-3 px-3 md:px-4">
                        <span
                          className="inline-block px-3 py-1 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: `${getStatusColor(task.status)}20`,
                            color: getStatusColor(task.status),
                          }}
                        >
                          {getStatusLabel(task.status)}
                        </span>
                      </td>
                      <td className="py-3 px-3 md:px-4 text-slate-400 whitespace-nowrap">
                        {new Date(task.createdAt).toLocaleString('zh-CN', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
