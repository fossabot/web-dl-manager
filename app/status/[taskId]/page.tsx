'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { message } from 'antd';
import { ChevronLeft, RefreshCcw, FileText, CloudUpload } from 'lucide-react';

interface TaskStatusData {
  status: {
    status: string;
    url: string;
    downloader: string;
    uploadService: string;
    uploadPath?: string;
    error?: string;
  };
  downloadLog: string;
  uploadLog: string;
}

export default function TaskDetailPage() {
  const params = useParams();
  const taskId = params.taskId as string;
  const router = useRouter();
  const [data, setData] = useState<TaskStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'download' | 'upload'>('download');
  const downloadLogRef = useRef<HTMLDivElement>(null);
  const uploadLogRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      } else {
        router.push('/tasks');
      }
    } catch (err) {
      console.error('Failed to fetch task status:', err);
      message.error('无法获取任务状态');
    } finally {
      setLoading(false);
    }
  }, [taskId, router]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    if (activeTab === 'download' && downloadLogRef.current) {
      downloadLogRef.current.scrollTop = downloadLogRef.current.scrollHeight;
    }
    if (activeTab === 'upload' && uploadLogRef.current) {
      uploadLogRef.current.scrollTop = uploadLogRef.current.scrollHeight;
    }
  }, [data?.downloadLog, data?.uploadLog, activeTab]);

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <RefreshCcw className="animate-spin text-blue-600 mx-auto mb-4" size={40} />
          <p className="text-slate-400">加载任务详情中...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-400 mb-4">任务不存在</p>
          <button onClick={() => router.push('/tasks')} className="btn-primary">
            返回任务列表
          </button>
        </div>
      </div>
    );
  }

  const { status, downloadLog, uploadLog } = data;

  const getStatusColor = (s: string) => {
    const colors: Record<string, string> = {
      completed: '#22c55e',
      failed: '#ef4444',
      downloading: '#f59e0b',
      uploading: '#3b82f6',
      compressing: '#8b5cf6',
      queued: '#64748b',
      paused: '#f59e0b',
    };
    return colors[s] || '#64748b';
  };

  const getStatusLabel = (s: string) => {
    const labels: Record<string, string> = {
      downloading: '下载中',
      completed: '已完成',
      failed: '失败',
      uploading: '上传中',
      compressing: '压缩中',
      queued: '等待中',
      paused: '已暂停',
    };
    return labels[s] || s;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="container-responsive max-w-6xl mx-auto pt-8 pb-20 md:pt-12 md:pb-12">
        {/* 返回按钮和标题 */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => router.push('/tasks')}
            className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <ChevronLeft size={24} className="text-slate-400" />
          </button>
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">任务详情</h1>
            <p className="text-slate-400 text-sm">ID: {taskId}</p>
          </div>
        </div>

        {/* 状态卡片 */}
        <div className="card-elevated p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 基本信息 */}
            <div className="space-y-4">
              <div>
                <p className="text-slate-400 text-sm mb-1">状态</p>
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block w-3 h-3 rounded-full"
                    style={{ backgroundColor: getStatusColor(status?.status || '') }}
                  />
                  <span className="text-white font-semibold">
                    {getStatusLabel(status?.status || '')}
                  </span>
                </div>
              </div>

              <div>
                <p className="text-slate-400 text-sm mb-1">下载工具</p>
                <p className="text-white">{status?.downloader || '-'}</p>
              </div>

              <div>
                <p className="text-slate-400 text-sm mb-1">URL</p>
                <p className="text-blue-400 text-sm truncate" title={status?.url}>
                  {status?.url}
                </p>
              </div>
            </div>

            {/* 上传信息 */}
            <div className="space-y-4">
              <div>
                <p className="text-slate-400 text-sm mb-1">上传服务</p>
                <p className="text-white">{status?.uploadService || '-'}</p>
              </div>

              <div>
                <p className="text-slate-400 text-sm mb-1">上传路径</p>
                <p className="text-white text-sm">{status?.uploadPath || '-'}</p>
              </div>

              {status?.error && (
                <div>
                  <p className="text-slate-400 text-sm mb-1">错误信息</p>
                  <p className="text-red-400 text-sm">{status.error}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 日志标签页 */}
        <div className="card-elevated overflow-hidden">
          {/* 标签页按钮 */}
          <div className="border-b border-slate-700 flex gap-0">
            <button
              onClick={() => setActiveTab('download')}
              className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors border-b-2 ${
                activeTab === 'download'
                  ? 'text-blue-400 border-blue-600'
                  : 'text-slate-400 border-transparent hover:text-slate-300'
              }`}
            >
              <FileText size={20} />
              下载日志
            </button>
            <button
              onClick={() => setActiveTab('upload')}
              className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors border-b-2 ${
                activeTab === 'upload'
                  ? 'text-blue-400 border-blue-600'
                  : 'text-slate-400 border-transparent hover:text-slate-300'
              }`}
            >
              <CloudUpload size={20} />
              上传日志
            </button>
          </div>

          {/* 日志内容 */}
          <div className="p-4 md:p-6">
            {activeTab === 'download' ? (
              <div
                ref={downloadLogRef}
                className="bg-slate-950/50 rounded-lg p-4 h-96 overflow-y-auto font-mono text-xs md:text-sm text-slate-300 whitespace-pre-wrap break-words"
              >
                {downloadLog || '暂无日志'}
              </div>
            ) : (
              <div
                ref={uploadLogRef}
                className="bg-slate-950/50 rounded-lg p-4 h-96 overflow-y-auto font-mono text-xs md:text-sm text-slate-300 whitespace-pre-wrap break-words"
              >
                {uploadLog || '暂无日志'}
              </div>
            )}
          </div>

          {/* 刷新按钮 */}
          <div className="border-t border-slate-700 p-4 flex justify-end">
            <button
              onClick={fetchData}
              className="btn-secondary flex items-center gap-2"
            >
              <RefreshCcw size={18} />
              刷新日志
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
