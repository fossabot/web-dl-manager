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
    <div className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm transition-all hover:shadow-md">
      <div className="mb-6 flex items-center gap-3 border-b border-slate-100 pb-5">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 shadow-sm">
          {Icon}
        </div>
        <h3 className="text-xl font-bold text-slate-900">{title}</h3>
      </div>
      {children}
    </div>
  );

  return (
    <div className="min-h-screen w-full bg-slate-50/50">
      <div className="mx-auto max-w-5xl px-6 py-12 md:py-20">
        <header className="mb-16 text-center">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-blue-600 mb-6 shadow-xl shadow-blue-600/20">
            <Rocket size={32} className="text-white" />
          </div>
          <h1 className="mb-4 text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight">
            Web-DL Manager
          </h1>
          <p className="text-slate-500 text-lg max-w-2xl mx-auto leading-relaxed">
            极简、高效、自动化的资源下载与备份系统。从各种站点下载资源并自动同步至您的云端。
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Step 1: Download Settings */}
          <CardSection icon={<CloudDownload size={20} />} title="下载配置">
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">下载引擎</label>
                <div className="relative">
                  <select
                    value={formValues.downloader}
                    onChange={(e) => handleFieldChange('downloader', e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 transition-all hover:border-blue-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/5 appearance-none cursor-pointer"
                  >
                    <option value="gallery-dl">Gallery-DL</option>
                    <option value="kemono-dl">Kemono-DL (Pro)</option>
                    <option value="megadl">Mega-DL</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">
                    <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
                      <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  目标 URL (每行一个)
                </label>
                <textarea
                  ref={urlRef}
                  rows={5}
                  placeholder="https://example.com/user/123"
                  value={formValues.url}
                  onChange={(e) => handleFieldChange('url', e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-mono text-sm text-slate-900 transition-all hover:border-blue-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/5 placeholder:text-slate-400"
                />
              </div>
            </div>
          </CardSection>

          {/* Step 2: Upload Settings */}
          <CardSection icon={<Rocket size={20} />} title="上传同步">
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">目标云存储</label>
                <div className="relative">
                  <select
                    value={formValues.upload_service}
                    onChange={(e) => handleFieldChange('upload_service', e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 transition-all hover:border-blue-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/5 appearance-none cursor-pointer"
                  >
                    <option value="">选择存储服务</option>
                    <option value="webdav">WebDAV</option>
                    <option value="s3">S3 兼容存储</option>
                    <option value="b2">Backblaze B2</option>
                    <option value="gofile">Gofile.io</option>
                    <option value="openlist">Openlist</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">
                    <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
                      <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                    </svg>
                  </div>
                </div>
              </div>

              {uploadService !== 'gofile' && (
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">远程备份路径</label>
                  <input
                    type="text"
                    placeholder="/downloads/images"
                    value={formValues.upload_path || ''}
                    onChange={(e) => handleFieldChange('upload_path', e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 transition-all hover:border-blue-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/5 placeholder:text-slate-400"
                  />
                </div>
              )}
            </div>
          </CardSection>

          {/* Step 3: Advanced Options */}
          <CardSection icon={<Settings size={20} />} title="进阶选项">
            <div className="space-y-8">
              <div className="flex flex-wrap gap-x-12 gap-y-6">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={formValues.enable_compression}
                    onChange={(e) => handleFieldChange('enable_compression', e.target.checked)}
                    className="h-6 w-6 cursor-pointer rounded-lg border-slate-200 bg-white text-blue-600 transition-all focus:ring-offset-0 focus:ring-4 focus:ring-blue-500/10 accent-blue-600"
                  />
                  <span className="text-base font-medium text-slate-700 group-hover:text-slate-900">
                    {formValues.enable_compression ? '启用压缩' : '禁用压缩'}
                  </span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={formValues.split_compression}
                    onChange={(e) => {
                      handleFieldChange('split_compression', e.target.checked);
                      setSplitSizeEnabled(e.target.checked);
                    }}
                    className="h-6 w-6 cursor-pointer rounded-lg border-slate-200 bg-white text-blue-600 transition-all focus:ring-offset-0 focus:ring-4 focus:ring-blue-500/10 accent-blue-600"
                  />
                  <span className="text-base font-medium text-slate-700 group-hover:text-slate-900">分卷压缩存档</span>
                </label>
              </div>

              {splitSizeEnabled && (
                <div className="w-full md:w-1/2 animate-in fade-in slide-in-from-top-2">
                  <label className="mb-2 block text-sm font-semibold text-slate-700">单分卷大小 (MB)</label>
                  <input
                    type="number"
                    min={1}
                    value={formValues.split_size}
                    onChange={(e) => handleFieldChange('split_size', parseInt(e.target.value, 10))}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 transition-all hover:border-blue-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/5"
                  />
                </div>
              )}
            </div>
          </CardSection>

          <div className="flex justify-center py-12">
            <button
              type="submit"
              disabled={loading}
              className="group relative flex h-16 w-full max-w-sm items-center justify-center overflow-hidden rounded-full bg-blue-600 font-bold text-white shadow-2xl shadow-blue-600/30 transition-all hover:bg-blue-700 hover:shadow-blue-600/40 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="relative z-10 flex items-center gap-3">
                {loading ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <Rocket size={22} className="transition-transform group-hover:-translate-y-1 group-hover:translate-x-1" />
                )}
                <span className="text-xl">{loading ? '正在处理任务...' : '立即启动下载'}</span>
              </div>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
