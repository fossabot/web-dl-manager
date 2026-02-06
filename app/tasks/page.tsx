'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function TasksPage() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
    if (!confirm('Are you sure you want to delete this task?')) return;
    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      if (res.ok) {
        fetchTasks();
      }
    } catch (err) {
      alert('Failed to delete task');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-900/50 text-green-300 border-green-500/30';
      case 'failed': return 'bg-red-900/50 text-red-300 border-red-500/30';
      case 'running': return 'bg-blue-900/50 text-blue-300 border-blue-500/30';
      case 'queued': return 'bg-slate-700/50 text-slate-300 border-slate-500/30';
      default: return 'bg-yellow-900/50 text-yellow-300 border-yellow-500/30';
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-white flex items-center">
          <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
          Tasks
        </h1>
        <Link href="/" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all">
          New Job
        </Link>
      </div>

      {loading && tasks.length === 0 ? (
        <div className="text-center py-12">
          <div className="animate-spin h-8 w-8 text-blue-500 mx-auto mb-4 border-4 border-slate-700 border-t-blue-500 rounded-full"></div>
          <p className="text-slate-400">Loading tasks...</p>
        </div>
      ) : tasks.length === 0 ? (
        <div className="bg-slate-800 rounded-2xl p-12 text-center border border-slate-700">
          <p className="text-slate-400 mb-6">No tasks found. Start your first download!</p>
          <Link href="/" className="text-blue-500 hover:text-blue-400 font-semibold">
            Go to Downloader →
          </Link>
        </div>
      ) : (
        <div className="grid gap-6">
          {tasks.map((task) => (
            <div key={task.id} className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-lg transition-all hover:border-slate-600">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex flex-col">
                    <span className="text-xs font-mono text-slate-500 mb-1">{task.id}</span>
                    <h3 className="text-sm font-medium text-slate-200 truncate max-w-md" title={task.url}>
                      {task.url}
                    </h3>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(task.status)} uppercase`}>
                    {task.status}
                  </span>
                </div>

                {task.error && (
                  <div className="bg-red-900/20 border border-red-500/20 rounded-lg p-3 mb-4">
                    <p className="text-xs text-red-400 font-mono break-words">{task.error}</p>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
                  <span className="flex items-center">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {new Date(task.createdAt).toLocaleString()}
                  </span>
                  <span className="flex items-center">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    {task.createdBy}
                  </span>
                </div>
              </div>

              <div className="bg-slate-800/50 px-6 py-4 border-t border-slate-700 flex justify-end items-center space-x-3">
                <Link
                  href={`/status/${task.id}`}
                  className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-semibold transition-all"
                >
                  View Logs
                </Link>
                <button
                  onClick={() => handleDelete(task.id)}
                  className="px-3 py-1.5 bg-red-900/50 hover:bg-red-900/70 text-red-200 border border-red-500/30 rounded-lg text-xs font-semibold transition-all"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
