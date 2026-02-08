'use client';

import { useState, useRef } from 'react';
import { CloudDownload, Settings, Rocket } from 'lucide-react';
import { message } from 'antd';

interface FormValues {
  downloader: string;
  url: string;
  upload_service: string;
  upload_path?: string;
  enable_compression: boolean;
  split_compression: boolean;
  split_size: number;
}

export default function DownloaderPage() {
  const [loading, setLoading] = useState(false);
  const [uploadService, setUploadService] = useState('');
  const [formValues, setFormValues] = useState<FormValues>({
    downloader: 'gallery-dl',
    url: '',
    upload_service: '',
    upload_path: '/downloads',
    enable_compression: true,
    split_compression: false,
    split_size: 1000,
  });
  const [splitSizeEnabled, setSplitSizeEnabled] = useState(false);
  const urlRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formValues.url.trim()) {
      message.error('请输入目标 URL');
      return;
    }

    if (!formValues.upload_service) {
      message.error('请选择上传服务');
      return;
    }

    setLoading(true);
    const formData = new FormData();
    Object.entries(formValues).forEach(([key, value]) => {
      formData.append(key, value?.toString() || '');
    });

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        message.success(`成功启动 ${data.taskIds.length} 个任务`);
        setFormValues({ ...formValues, url: '' });
        if (urlRef.current) urlRef.current.value = '';
      } else {
        message.error(data.error || '任务启动失败');
      }
    } catch {
      message.error('请求发生错误');
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (key: keyof FormValues, value: string | number | boolean) => {
    setFormValues((prev) => ({ ...prev, [key]: value }));
    if (key === 'upload_service') {
      setUploadService(String(value));
    }
  };

  const CardSection = ({ icon: Icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) => (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-6 shadow-sm">
      <div className="mb-6 flex items-center gap-3 border-b border-slate-800 pb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600/20 text-blue-400">
          {Icon}
        </div>
        <h3 className="text-lg font-semibold text-slate-100">{title}</h3>
      </div>
      {children}
    </div>
  );

  return (
    <div className="min-h-screen w-full bg-slate-950">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <header className="mb-12 text-center">
          <h1 className="mb-2 bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-400 bg-clip-text text-4xl font-bold text-transparent">
            下载管理器
          </h1>
          <p className="text-slate-400">从各种站点下载图片和视频，并自动备份至云存储</p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Step 1: Download Settings */}
          <CardSection icon={<CloudDownload size={20} />} title="步骤 1：下载设置">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">下载引擎</label>
                <select
                  value={formValues.downloader}
                  onChange={(e) => handleFieldChange('downloader', e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-slate-100 transition-colors hover:border-slate-600 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="gallery-dl">Gallery-DL</option>
                  <option value="kemono-dl">Kemono-DL (Pro)</option>
                  <option value="megadl">Mega-DL</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  目标 URL (每行一个)
                </label>
                <textarea
                  ref={urlRef}
                  rows={5}
                  placeholder="https://example.com/user/123"
                  value={formValues.url}
                  onChange={(e) => handleFieldChange('url', e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 font-mono text-sm text-slate-100 transition-colors hover:border-slate-600 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>
          </CardSection>

          {/* Step 2: Upload Settings */}
          <CardSection icon={<Rocket size={20} />} title="步骤 2：上传设置">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">目标服务</label>
                <select
                  value={formValues.upload_service}
                  onChange={(e) => handleFieldChange('upload_service', e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-slate-100 transition-colors hover:border-slate-600 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="">选择存储服务</option>
                  <option value="webdav">WebDAV</option>
                  <option value="s3">S3 兼容存储</option>
                  <option value="b2">Backblaze B2</option>
                  <option value="gofile">Gofile.io</option>
                  <option value="openlist">Openlist</option>
                </select>
              </div>

              {uploadService !== 'gofile' && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">远程路径</label>
                  <input
                    type="text"
                    placeholder="/downloads/images"
                    value={formValues.upload_path || ''}
                    onChange={(e) => handleFieldChange('upload_path', e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-slate-100 transition-colors hover:border-slate-600 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              )}
            </div>
          </CardSection>

          {/* Step 3: Advanced Options */}
          <CardSection icon={<Settings size={20} />} title="步骤 3：高级选项">
            <div className="space-y-6">
              <div className="flex flex-wrap gap-12">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formValues.enable_compression}
                    onChange={(e) => handleFieldChange('enable_compression', e.target.checked)}
                    className="h-5 w-5 cursor-pointer rounded border-slate-600 bg-slate-700 text-blue-600 transition-colors hover:bg-slate-600 focus:ring-2 focus:ring-blue-500/20"
                  />
                  <span className="text-sm font-medium text-slate-300">
                    {formValues.enable_compression ? '启用压缩' : '禁用压缩'}
                  </span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formValues.split_compression}
                    onChange={(e) => {
                      handleFieldChange('split_compression', e.target.checked);
                      setSplitSizeEnabled(e.target.checked);
                    }}
                    className="h-5 w-5 cursor-pointer rounded border-slate-600 bg-slate-700 text-blue-600 transition-colors hover:bg-slate-600 focus:ring-2 focus:ring-blue-500/20"
                  />
                  <span className="text-sm font-medium text-slate-300">分卷压缩</span>
                </label>
              </div>

              {splitSizeEnabled && (
                <div className="w-full md:w-1/3">
                  <label className="mb-2 block text-sm font-medium text-slate-300">分卷大小 (MB)</label>
                  <input
                    type="number"
                    min={1}
                    value={formValues.split_size}
                    onChange={(e) => handleFieldChange('split_size', parseInt(e.target.value, 10))}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-slate-100 transition-colors hover:border-slate-600 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              )}
            </div>
          </CardSection>

          <div className="flex justify-center py-8">
            <button
              type="submit"
              disabled={loading}
              className="rounded-full bg-gradient-to-r from-blue-500 via-cyan-500 to-blue-500 px-12 py-3.5 text-lg font-bold text-white shadow-lg transition-all hover:shadow-xl hover:shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ width: 240, height: 56 }}
            >
              {loading ? '处理中...' : '开始下载任务'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
