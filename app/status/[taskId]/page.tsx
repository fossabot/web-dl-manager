'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Typography, Card, Tag, Space, Button, Breadcrumb } from 'antd';
import { ChevronLeft, RefreshCcw, FileText, CloudUpload, Info } from 'lucide-react';

const { Title, Text } = Typography;

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

export default function StatusPage() {
  const params = useParams();
  const taskId = params.taskId as string;
  const router = useRouter();
  const [data, setData] = useState<TaskStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const downloadLogRef = useRef<HTMLDivElement>(null);

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
    if (downloadLogRef.current) {
      downloadLogRef.current.scrollTop = downloadLogRef.current.scrollHeight;
    }
  }, [data?.downloadLog]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <RefreshCcw className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  const { status, downloadLog, uploadLog } = data || {};

  const getStatusColor = (s: string) => {
    switch (s) {
      case 'completed': return 'success';
      case 'failed': return 'error';
      case 'running': return 'processing';
      default: return 'default';
    }
  };

  return (
    <div className="min-h-screen bg-[#000] text-slate-200 p-6">
      <div className="max-w-[1600px] mx-auto">
        <header className="mb-8 flex justify-between items-center">
          <Space direction="vertical" size={0}>
            <Breadcrumb
              items={[
                { title: <span className="text-slate-500">任务列表</span>, href: '/tasks' },
                { title: <span className="text-slate-300">任务详情</span> },
              ]}
              className="mb-2"
            />
            <Title level={3} className="m-0 text-white flex items-center">
              <code className="bg-slate-900 px-2 py-1 rounded text-blue-400 mr-3 text-lg">{taskId.slice(0, 8)}</code>
              {status?.status && <Tag color={getStatusColor(status.status)} className="ml-2 uppercase font-bold">{status.status}</Tag>}
            </Title>
          </Space>
          <Button 
            icon={<ChevronLeft size={16} />} 
            onClick={() => router.push('/tasks')}
            className="bg-slate-900 border-slate-800 text-slate-300 hover:text-white"
          >
            返回列表
          </Button>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          {/* Info Panel */}
          <div className="xl:col-span-1 space-y-6">
            <Card title={<Space><Info size={16}/><span>基础信息</span></Space>} className="bg-slate-900/50 border-slate-800 text-slate-300">
              <div className="space-y-4">
                <div>
                  <Text type="secondary" className="text-[10px] uppercase font-bold tracking-widest block mb-1">目标 URL</Text>
                  <div className="bg-black/50 p-3 rounded-lg border border-slate-800 font-mono text-xs break-all">
                    {status?.url}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Text type="secondary" className="text-[10px] uppercase font-bold tracking-widest block mb-1">下载器</Text>
                    <Text className="text-sm font-medium text-white">{status?.downloader}</Text>
                  </div>
                  <div>
                    <Text type="secondary" className="text-[10px] uppercase font-bold tracking-widest block mb-1">上传至</Text>
                    <Text className="text-sm font-medium text-white">{status?.uploadService}</Text>
                  </div>
                </div>
                {status?.uploadPath && (
                  <div>
                    <Text type="secondary" className="text-[10px] uppercase font-bold tracking-widest block mb-1">远程路径</Text>
                    <Text className="text-xs font-mono text-blue-300">{status.uploadPath}</Text>
                  </div>
                )}
              </div>
            </Card>

            {status?.error && (
              <Card className="bg-red-950/20 border-red-900/50">
                <Text type="danger" className="text-xs font-mono">{status.error}</Text>
              </Card>
            )}
          </div>

          {/* Logs Panel */}
          <div className="xl:col-span-3 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[650px]">
              {/* Download Log */}
              <div className="flex flex-col bg-black rounded-2xl border border-slate-800 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
                  <Space><FileText size={14} className="text-blue-400"/> <span className="text-xs font-bold uppercase tracking-wider text-slate-400">下载日志</span></Space>
                </div>
                <div 
                  ref={downloadLogRef}
                  className="flex-1 p-4 overflow-y-auto font-mono text-[11px] leading-relaxed text-slate-400 scrollbar-thin scrollbar-thumb-slate-800"
                >
                  <pre className="whitespace-pre-wrap break-all">{downloadLog || '等待输出...'}</pre>
                </div>
              </div>

              {/* Upload Log */}
              <div className="flex flex-col bg-black rounded-2xl border border-slate-800 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
                  <Space><CloudUpload size={14} className="text-purple-400"/> <span className="text-xs font-bold uppercase tracking-wider text-slate-400">上传日志</span></Space>
                </div>
                <div 
                  className="flex-1 p-4 overflow-y-auto font-mono text-[11px] leading-relaxed text-slate-400 scrollbar-thin scrollbar-thumb-slate-800"
                >
                  <pre className="whitespace-pre-wrap break-all">{uploadLog || '等待输出...'}</pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
