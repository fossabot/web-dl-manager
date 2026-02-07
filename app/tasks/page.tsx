'use client';

import { useState, useEffect } from 'react';
import { ListTodo, Trash2, Eye, RefreshCw, ChevronLeft, Filter, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface Task {
  id: string;
  url: string;
  status: string;
  createdAt: string;
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fetchTasks = async () => {
    try {
      const res = await fetch('/api/tasks');
      if (res.ok) {
        const data = await res.json();
        setTasks(data);
      }
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleDelete = async (taskId: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      if (res.ok) {
        setTasks(tasks.filter(t => t.id !== taskId));
        setDeleteConfirm(null);
      }
    } catch {
      console.error('删除任务失败');
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'completed': return 'bg-green-900/30 text-green-400 border-green-700/50';
      case 'failed': return 'bg-red-900/30 text-red-400 border-red-700/50';
      case 'running': return 'bg-blue-900/30 text-blue-400 border-blue-700/50';
      case 'queued': return 'bg-slate-700/30 text-slate-300 border-slate-600/50';
      case 'compressing': return 'bg-yellow-900/30 text-yellow-400 border-yellow-700/50';
      case 'uploading': return 'bg-cyan-900/30 text-cyan-400 border-cyan-700/50';
      default: return 'bg-slate-700/30 text-slate-300 border-slate-600/50';
    }
  };

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'completed': return '已完成';
      case 'failed': return '失败';
      case 'running': return '运行中';
      case 'queued': return '队列中';
      case 'compressing': return '压缩中';
      case 'uploading': return '上传中';
      default: return status;
    }
  };

  const uniqueStatuses = Array.from(new Set(tasks.map(t => t.status)));
  const filteredTasks = statusFilter 
    ? tasks.filter(t => t.status === statusFilter)
    : tasks;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 md:py-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <h1 className="flex items-center text-2xl md:text-3xl font-bold gap-2">
          <ListTodo className="text-blue-500" size={28} /> 任务列表
        </h1>
        <div className="flex gap-2 items-center w-full sm:w-auto">
          <button
            onClick={() => setSidebarVisible(!sidebarVisible)}
            className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors text-slate-300 hover:text-white md:hidden"
            title={sidebarVisible ? '收起侧栏' : '展开侧栏'}
          >
            <ChevronLeft size={18} className={`transition-transform ${!sidebarVisible ? 'rotate-180' : ''}`} />
          </button>
          <Link href="/" className="flex-1 sm:flex-none">
            <button className="w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium">
              新建任务
            </button>
          </Link>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Left Sidebar */}
        <div className={`transition-all duration-300 ${
          sidebarVisible ? 'md:w-56 opacity-100 order-2 md:order-1' : 'md:w-0 md:opacity-0 md:overflow-hidden hidden md:block'
        }`}>
          <div className="card-elevated sticky top-24 h-fit p-4">
            <div className="mb-4 flex items-center gap-2">
              <Filter size={16} className="text-blue-500" />
              <span className="font-semibold text-sm">任务统计</span>
            </div>
            
            <div className="space-y-2 mb-4">
              <div 
                onClick={() => setStatusFilter(null)}
                className={`p-3 rounded-lg cursor-pointer transition-all text-sm ${
                  statusFilter === null
                    ? 'bg-blue-600/20 border border-blue-600 text-blue-400'
                    : 'bg-slate-700/30 hover:bg-slate-700/50 text-slate-300'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="font-medium">全部</span>
                  <span className="font-bold">{tasks.length}</span>
                </div>
              </div>

              {uniqueStatuses.map((status) => {
                const count = tasks.filter(t => t.status === status).length;
                return (
                  <div
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`p-3 rounded-lg cursor-pointer transition-all text-sm ${
                      statusFilter === status
                        ? 'bg-blue-600/20 border border-blue-600'
                        : 'bg-slate-700/30 hover:bg-slate-700/50'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="inline-flex items-center gap-2">
                        <span className={`px-2 py-1 rounded border text-xs font-medium ${getStatusColor(status)}`}>
                          {getStatusLabel(status)}
                        </span>
                      </span>
                      <span className={`font-bold ${statusFilter === status ? 'text-blue-400' : 'text-slate-400'}`}>
                        {count}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {statusFilter && (
              <button 
                onClick={() => setStatusFilter(null)}
                className="w-full text-xs py-2 text-slate-300 hover:text-white transition-colors"
              >
                清除过滤
              </button>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 order-1 md:order-2">
          <div className="card-elevated overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="animate-spin text-blue-500" size={32} />
              </div>
            ) : (
              <>
                {filteredTasks.length === 0 ? (
                  <div className="py-12 text-center">
                    <p className="text-slate-400">暂无任务</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-900/50 border-b border-slate-700/50">
                      <th className="text-left px-4 py-3 text-sm font-semibold text-slate-300">任务 ID</th>
                      <th className="text-left px-4 py-3 text-sm font-semibold text-slate-300">目标 URL</th>
                      <th className="text-left px-4 py-3 text-sm font-semibold text-slate-300">状态</th>
                      <th className="text-left px-4 py-3 text-sm font-semibold text-slate-300">创建时间</th>
                      <th className="text-center px-4 py-3 text-sm font-semibold text-slate-300">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTasks.map((task) => (
                      <tr key={task.id} className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors">
                        <td className="px-4 py-3">
                          <code className="text-xs text-slate-500 bg-slate-700/30 px-2 py-1 rounded">
                            {task.id.slice(0, 8)}...
                          </code>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-slate-300 truncate block max-w-xs" title={task.url}>
                            {task.url}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {task.status === 'running' && (
                              <RefreshCw size={12} className="animate-spin text-blue-400" />
                            )}
                            <span className={`px-2 py-1 rounded text-xs font-medium border ${getStatusColor(task.status)}`}>
                              {getStatusLabel(task.status)}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-slate-500">
                            {new Date(task.createdAt).toLocaleString('zh-CN')}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-2">
                            <Link href={`/status/${task.id}`}>
                              <button className="p-1.5 hover:bg-slate-600/50 rounded transition-colors text-slate-300 hover:text-white" title="查看详情">
                                <Eye size={16} />
                              </button>
                            </Link>
                            <div className="relative group">
                              <button 
                                onClick={() => setDeleteConfirm(deleteConfirm === task.id ? null : task.id)}
                                className="p-1.5 hover:bg-red-600/20 rounded transition-colors text-red-400 hover:text-red-300"
                                title="删除任务"
                              >
                                <Trash2 size={16} />
                              </button>
                              {deleteConfirm === task.id && (
                                <div className="absolute right-0 top-full mt-1 z-10 bg-slate-800 border border-slate-700 rounded-lg shadow-lg p-2">
                                  <p className="text-xs text-slate-300 mb-2 whitespace-nowrap">确定删除？</p>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleDelete(task.id)}
                                      className="px-2 py-1 bg-red-600/50 hover:bg-red-600 text-white text-xs rounded transition-colors"
                                    >
                                      删除
                                    </button>
                                    <button
                                      onClick={() => setDeleteConfirm(null)}
                                      className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded transition-colors"
                                    >
                                      取消
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}