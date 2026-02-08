'use client';

import { useState, useEffect, useCallback } from 'react';
import { message } from 'antd';
import { Save, RotateCcw } from 'lucide-react';

interface FormData {
  [key: string]: string | number | boolean | undefined;
}

export const dynamic = 'force-dynamic';

export default function SettingsPage() {
  const [formData, setFormData] = useState<FormData>({});
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('system');

  const fetchConfig = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const data = await res.json();
        setFormData(data);
      }
    } catch (error) {
      console.error('Failed to fetch config:', error);
      message.error('加载配置失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleSaveConfig = async (): Promise<void> => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        message.success('配置保存成功');
      } else {
        message.error('配置保存失败');
      }
    } catch (error) {
      console.error('Failed to save config:', error);
      message.error('保存配置时出错');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFieldChange = (key: string, value: string | number | boolean | undefined): void => {
    setFormData((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const InputField = ({ label, name, type = 'text', placeholder }: { label: string; name: string; type?: string; placeholder?: string }) => (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        value={String(formData[name] || '')}
        onChange={(e) => handleFieldChange(name, e.target.value)}
        className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-slate-900 transition-colors hover:border-blue-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/10"
      />
    </div>
  );

  const TextAreaField = ({ label, name, rows = 4, placeholder }: { label: string; name: string; rows?: number; placeholder?: string }) => (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      <textarea
        rows={rows}
        placeholder={placeholder}
        value={String(formData[name] || '')}
        onChange={(e) => handleFieldChange(name, e.target.value)}
        className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-slate-900 transition-colors hover:border-blue-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/10"
      />
    </div>
  );

  const PasswordField = ({ label, name, placeholder }: { label: string; name: string; placeholder?: string }) => (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      <input
        type="password"
        placeholder={placeholder}
        value={String(formData[name] || '')}
        onChange={(e) => handleFieldChange(name, e.target.value)}
        className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-slate-900 transition-colors hover:border-blue-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/10"
      />
    </div>
  );

  const SelectField = ({ label, name, options }: { label: string; name: string; options: { value: string; label: string }[] }) => (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      <div className="relative">
        <select
          value={String(formData[name] || options[0]?.value || '')}
          onChange={(e) => handleFieldChange(name, e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-slate-900 transition-colors hover:border-blue-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/10 appearance-none cursor-pointer"
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
          <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
            <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
          </svg>
        </div>
      </div>
    </div>
  );

  const TabButton = ({ id, label }: { id: string; label: string }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`px-4 py-2 text-sm font-medium transition-all ${
        activeTab === id
          ? 'border-b-2 border-blue-600 text-blue-600'
          : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-t-lg'
      }`}
    >
      {label}
    </button>
  );

  const InfoBox = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-4">
      <div className="mb-2 text-sm font-semibold text-blue-700 flex items-center gap-2">
        <span>ℹ️</span> {title}
      </div>
      <div className="text-sm text-slate-600 leading-relaxed">{children}</div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-slate-500 animate-pulse">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 p-6">
      <div className="mx-auto max-w-4xl space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">系统设置</h1>
            <p className="mt-1 text-slate-500">管理您的应用配置和上传服务</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-200">
          <div className="flex gap-2">
            <TabButton id="system" label="核心配置" />
            <TabButton id="upload" label="上传服务" />
            <TabButton id="background" label="背景设置" />
          </div>
        </div>

        {/* Content */}
        <div className="space-y-6">
          {/* System Settings Tab */}
          {activeTab === 'system' && (
            <div className="space-y-6">
              <InputField label="应用名称" name="APP_NAME" placeholder="WDM 下载管理器" />
              <TextAreaField label="应用描述" name="APP_DESC" placeholder="应用描述" rows={4} />
              <InputField label="API 端口" name="PORT" type="number" placeholder="6275" />

              <InfoBox title="数据库配置">
                <div className="space-y-2">
                  <p>数据库连接应通过环境变量 <code className="rounded bg-slate-800 px-2 py-1 text-xs">DATABASE_URL</code> 配置。</p>
                  <p className="mt-3 font-semibold">支持的数据库类型：</p>
                  <ul className="mt-2 ml-4 space-y-1 list-disc">
                    <li>MySQL: <code className="rounded bg-slate-800 px-2 py-1 text-xs">mysql://user:pass@host:3306/db</code></li>
                    <li>PostgreSQL: <code className="rounded bg-slate-800 px-2 py-1 text-xs">postgresql://user:pass@host:5432/db</code></li>
                    <li>SQLite: <code className="rounded bg-slate-800 px-2 py-1 text-xs">file:./webdl-manager.db</code></li>
                    <li>Redis: <code className="rounded bg-slate-800 px-2 py-1 text-xs">redis://[:password]@host:port[/db]</code></li>
                  </ul>
                </div>
              </InfoBox>
            </div>
          )}

          {/* Upload Services Tab */}
          {activeTab === 'upload' && (
            <div className="space-y-6">
              <InfoBox title="上传服务配置">
                下载页面中的上传服务选择框会显示所有支持的服务。请根据需要配置相应的服务凭证。
              </InfoBox>

              {/* WebDAV */}
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="mb-4 text-lg font-semibold text-slate-900">WebDAV</h3>
                <div className="space-y-4">
                  <InputField label="服务器地址" name="WEBDAV_URL" placeholder="https://webdav.example.com" />
                  <InputField label="用户名" name="WEBDAV_USER" placeholder="用户名" />
                  <PasswordField label="密码" name="WEBDAV_PASS" placeholder="密码" />
                </div>
              </div>

              {/* S3 */}
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="mb-4 text-lg font-semibold text-slate-900">S3 兼容存储</h3>
                <div className="space-y-4">
                  <InputField label="端点" name="S3_ENDPOINT" placeholder="https://s3.example.com" />
                  <PasswordField label="访问密钥 (Access Key)" name="S3_ACCESS_KEY" placeholder="访问密钥" />
                  <PasswordField label="秘密密钥 (Secret Key)" name="S3_SECRET_KEY" placeholder="秘密密钥" />
                  <InputField label="桶名称" name="S3_BUCKET" placeholder="bucket-name" />
                  <InputField label="区域 (Region)" name="S3_REGION" placeholder="us-east-1" />
                </div>
              </div>

              {/* Backblaze B2 */}
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="mb-4 text-lg font-semibold text-slate-900">Backblaze B2</h3>
                <div className="space-y-4">
                  <PasswordField label="应用密钥 ID" name="B2_APP_KEY_ID" placeholder="应用密钥 ID" />
                  <PasswordField label="应用密钥" name="B2_APP_KEY" placeholder="应用密钥" />
                  <InputField label="桶 ID" name="B2_BUCKET_ID" placeholder="桶 ID" />
                </div>
              </div>

              {/* Gofile */}
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="mb-4 text-lg font-semibold text-slate-900">Gofile</h3>
                <div className="space-y-4">
                  <PasswordField label="API 密钥" name="GOFILE_API_KEY" placeholder="Gofile API 密钥" />
                  <InputField label="文件夹 ID" name="GOFILE_FOLDER_ID" placeholder="默认文件夹 ID（可选）" />
                </div>
              </div>

              {/* OpenList */}
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="mb-4 text-lg font-semibold text-slate-900">OpenList</h3>
                <div className="space-y-4">
                  <InputField label="服务器地址" name="OPENLIST_URL" placeholder="https://openlist.example.com" />
                  <InputField label="用户名" name="OPENLIST_USER" placeholder="用户名" />
                  <PasswordField label="密码" name="OPENLIST_PASS" placeholder="密码" />
                </div>
              </div>
            </div>
          )}

          {/* Background Settings Tab */}
          {activeTab === 'background' && (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={formData.WDM_BG_ENABLED === true || formData.WDM_BG_ENABLED === '1'}
                    onChange={(e) => handleFieldChange('WDM_BG_ENABLED', e.target.checked)}
                    className="h-5 w-5 cursor-pointer rounded border-slate-300 bg-white text-blue-600 transition-all focus:ring-2 focus:ring-blue-500/20 accent-blue-600"
                  />
                  <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900 transition-colors">启用自定义背景</span>
                </label>
              </div>

              {(formData.WDM_BG_ENABLED === true || formData.WDM_BG_ENABLED === '1') && (
                <div className="space-y-6">
                  <TextAreaField
                    label="背景资源 URL"
                    name="WDM_BG_URL"
                    placeholder="输入图片或视频的外链 URL"
                    rows={3}
                  />

                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <SelectField
                      label="覆盖类型"
                      name="WDM_BG_POSITION"
                      options={[
                        { value: 'center', label: '居中' },
                        { value: 'cover', label: '铺满' },
                        { value: 'contain', label: '包含' },
                        { value: 'stretch', label: '拉伸' },
                      ]}
                    />

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-slate-700">不透明度</label>
                      <input
                        type="number"
                        min="0"
                        max="1"
                        step="0.1"
                        value={Number(formData.WDM_BG_OPACITY || 1)}
                        onChange={(e) => handleFieldChange('WDM_BG_OPACITY', parseFloat(e.target.value))}
                        className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-slate-900 transition-colors hover:border-blue-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/10"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 border-t border-slate-200 pt-8">
          <button
            onClick={handleSaveConfig}
            disabled={isSaving}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-8 py-3 font-semibold text-white transition-all hover:bg-blue-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-600/20"
          >
            <Save size={20} />
            保存配置
          </button>
          <button
            onClick={fetchConfig}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-8 py-3 font-semibold text-slate-600 transition-all hover:bg-slate-50 hover:text-slate-900 active:scale-95 shadow-sm"
          >
            <RotateCcw size={20} />
            重新加载
          </button>
        </div>
      </div>
    </div>
  );
}
