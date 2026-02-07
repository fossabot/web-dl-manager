'use client';

import { useState } from 'react';
import { message } from 'antd';
import { Cloud, Download, Zap, ArrowRight } from 'lucide-react';

export default function DownloaderPage() {
  const [formData, setFormData] = useState({
    downloader: 'gallery-dl',
    url: '',
    upload_service: '',
    upload_path: '/downloads',
    enable_compression: true,
    split_compression: false,
    split_size: 1000,
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (field: string, value: string | number | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.url) {
      message.error('请输入目标 URL');
      return;
    }
    if (!formData.upload_service) {
      message.error('请选择上传服务');
      return;
    }

    setLoading(true);
    const form = new FormData();
    Object.entries(formData).forEach(([key, value]) => {
      form.append(key, String(value));
    });

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        body: form,
      });
      const data = await res.json();
      if (res.ok) {
        message.success(`成功启动 ${data.taskIds.length} 个任务`);
        setFormData(prev => ({ ...prev, url: '' }));
      } else {
        message.error(data.error || '任务启动失败');
      }
    } catch {
      message.error('请求发生错误');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="container-responsive max-w-6xl mx-auto pt-8 pb-20 md:pt-12 md:pb-12">
        {/* 标题区 */}
        <div className="mb-12 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Cloud size={32} className="text-blue-600" />
            <h1 className="text-3xl md:text-4xl font-bold text-white">下载管理器</h1>
          </div>
          <p className="text-slate-400 text-sm md:text-base">从各种站点下载图片和视频，并自动备份至云存储</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-6">
          {/* Step 1: 下载设置 */}
          <div className="card-elevated p-6">
            <div className="flex items-center gap-3 mb-6">
              <Download size={24} className="text-blue-600" />
              <h2 className="text-xl font-semibold text-white">步骤 1：下载设置</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* 下载引擎选择 */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">下载引擎</label>
                <select
                  value={formData.downloader}
                  onChange={(e) => handleChange('downloader', e.target.value)}
                  className="input-base"
                >
                  <option value="gallery-dl">Gallery-DL</option>
                  <option value="kemono-dl">Kemono-DL (Pro)</option>
                  <option value="megadl">Mega-DL</option>
                </select>
              </div>

              {/* URL 输入 */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-300 mb-2">目标 URL (每行一个)</label>
                <textarea
                  value={formData.url}
                  onChange={(e) => handleChange('url', e.target.value)}
                  rows={5}
                  placeholder="https://example.com/user/123"
                  className="input-base font-mono text-sm resize-none"
                />
              </div>
            </div>
          </div>

          {/* Step 2: 上传设置 */}
          <div className="card-elevated p-6">
            <div className="flex items-center gap-3 mb-6">
              <Zap size={24} className="text-amber-600" />
              <h2 className="text-xl font-semibold text-white">步骤 2：上传设置</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">目标服务</label>
                <select
                  value={formData.upload_service}
                  onChange={(e) => handleChange('upload_service', e.target.value)}
                  className="input-base"
                >
                  <option value="">选择存储服务</option>
                  <option value="webdav">WebDAV</option>
                  <option value="s3">S3 兼容存储</option>
                  <option value="b2">Backblaze B2</option>
                  <option value="gofile">Gofile.io</option>
                  <option value="openlist">Openlist</option>
                </select>
              </div>

              {formData.upload_service !== 'gofile' && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">远程路径</label>
                  <input
                    type="text"
                    value={formData.upload_path}
                    onChange={(e) => handleChange('upload_path', e.target.value)}
                    placeholder="/downloads/images"
                    className="input-base"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Step 3: 高级选项 */}
          <div className="card-elevated p-6">
            <div className="flex items-center gap-3 mb-6">
              <Zap size={24} className="text-green-600" />
              <h2 className="text-xl font-semibold text-white">步骤 3：高级选项</h2>
            </div>

            <div className="space-y-6">
              {/* 开关选项 */}
              <div className="flex flex-wrap gap-8">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.enable_compression}
                    onChange={(e) => handleChange('enable_compression', e.target.checked)}
                    className="w-5 h-5 rounded border-slate-600 text-blue-600"
                  />
                  <span className="text-slate-300">启用压缩</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.split_compression}
                    onChange={(e) => handleChange('split_compression', e.target.checked)}
                    className="w-5 h-5 rounded border-slate-600 text-blue-600"
                  />
                  <span className="text-slate-300">分卷压缩</span>
                </label>
              </div>

              {/* 分卷大小 */}
              {formData.split_compression && (
                <div className="w-full md:w-1/3">
                  <label className="block text-sm font-medium text-slate-300 mb-2">分卷大小 (MB)</label>
                  <input
                    type="number"
                    min={1}
                    value={formData.split_size}
                    onChange={(e) => handleChange('split_size', parseInt(e.target.value))}
                    className="input-base"
                  />
                </div>
              )}
            </div>
          </div>

          {/* 提交按钮 */}
          <div className="flex justify-center pt-8">
            <button
              type="submit"
              disabled={loading}
              className="btn-primary px-8 py-3 text-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download size={20} />
              {loading ? '启动中...' : '开始下载任务'}
              <ArrowRight size={20} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}