'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function StatusPage() {
  const { taskId } = useParams();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const logEndRef = useRef<HTMLDivElement>(null);

  const fetchData = async () => {
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
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [taskId]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [data?.downloadLog]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-8 w-8 text-blue-500 border-4 border-slate-700 border-t-blue-500 rounded-full"></div>
      </div>
    );
  }

  const { status, downloadLog, uploadLog } = data || {};

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Task Detail</h1>
          <p className="text-xs font-mono text-slate-500">{taskId}</p>
        </div>
        <div className="flex items-center space-x-3">
          <span className={`px-4 py-1.5 rounded-full text-xs font-bold border uppercase ${
            status?.status === 'completed' ? 'bg-green-900/50 text-green-300 border-green-500/30' :
            status?.status === 'failed' ? 'bg-red-900/50 text-red-300 border-red-500/30' :
            'bg-blue-900/50 text-blue-300 border-blue-500/30'
          }`}>
            {status?.status}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-xl">
            <div className="px-6 py-4 border-b border-slate-700 bg-slate-800/50 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Download Log</h2>
              <button onClick={() => fetchData()} className="text-blue-400 hover:text-blue-300 text-xs font-medium">Refresh</button>
            </div>
            <div className="p-0 h-[500px] overflow-y-auto bg-black font-mono text-[11px] leading-relaxed text-slate-300">
              <pre className="p-6 whitespace-pre-wrap break-all">
                {downloadLog || 'Waiting for log content...'}
                <div ref={logEndRef} />
              </pre>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-xl">
            <div className="px-6 py-4 border-b border-slate-700 bg-slate-800/50">
              <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Task Info</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Target URL</label>
                <div className="text-sm text-slate-200 break-all bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
                  {status?.url}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Downloader</label>
                  <div className="text-sm text-slate-200">{status?.downloader}</div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Upload Service</label>
                  <div className="text-sm text-slate-200">{status?.uploadService}</div>
                </div>
              </div>
              {status?.uploadPath && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Remote Path</label>
                  <div className="text-sm text-slate-200 font-mono">{status?.uploadPath}</div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-xl">
            <div className="px-6 py-4 border-b border-slate-700 bg-slate-800/50">
              <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Upload Log</h2>
            </div>
            <div className="p-0 h-[250px] overflow-y-auto bg-black font-mono text-[11px] leading-relaxed text-slate-300">
              <pre className="p-6 whitespace-pre-wrap break-all">
                {uploadLog || 'Waiting for upload log...'}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
