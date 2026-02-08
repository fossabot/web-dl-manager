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
      <label className="block text-sm font-medium text-slate-300">{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        value={String(formData[name] || '')}
        onChange={(e) => handleFieldChange(name, e.target.value)}
        className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-slate-100 transition-colors hover:border-slate-600 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
      />
    </div>
  );

  const TextAreaField = ({ label, name, rows = 4, placeholder }: { label: string; name: string; rows?: number; placeholder?: string }) => (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-300">{label}</label>
      <textarea
        rows={rows}
        placeholder={placeholder}
        value={String(formData[name] || '')}
        onChange={(e) => handleFieldChange(name, e.target.value)}
        className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-slate-100 transition-colors hover:border-slate-600 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
      />
    </div>
  );

  const PasswordField = ({ label, name, placeholder }: { label: string; name: string; placeholder?: string }) => (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-300">{label}</label>
      <input
        type="password"
        placeholder={placeholder}
        value={String(formData[name] || '')}
        onChange={(e) => handleFieldChange(name, e.target.value)}
        className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-slate-100 transition-colors hover:border-slate-600 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
      />
    </div>
  );

  const SelectField = ({ label, name, options }: { label: string; name: string; options: { value: string; label: string }[] }) => (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-300">{label}</label>
      <select
        value={String(formData[name] || options[0]?.value || '')}
        onChange={(e) => handleFieldChange(name, e.target.value)}
        className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-slate-100 transition-colors hover:border-slate-600 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );

  const TabButton = ({ id, label }: { id: string; label: string }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`px-4 py-2 text-sm font-medium transition-colors ${
        activeTab === id
          ? 'border-b-2 border-blue-500 text-blue-400'
          : 'text-slate-400 hover:text-slate-300'
      }`}
    >
      {label}
    </button>
  );

  const InfoBox = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-4">
      <div className="mb-2 text-sm font-semibold text-blue-400">ℹ️ {title}</div>
      <div className="text-sm text-slate-300">{children}</div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <div className="text-slate-400">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-100">系统设置</h1>
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-800">
          <div className="flex gap-4">
            <TabButton id="system" label="系统配置" />
            <TabButton id="upload" label="上传服务" />
            <TabButton id="background" label="自定义背景" />
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
              <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-6 shadow-sm">
                <h3 className="mb-4 text-lg font-semibold text-slate-100">WebDAV</h3>
                <div className="space-y-4">
                  <InputField label="服务器地址" name="WEBDAV_URL" placeholder="https://webdav.example.com" />
                  <InputField label="用户名" name="WEBDAV_USER" placeholder="用户名" />
                  <PasswordField label="密码" name="WEBDAV_PASS" placeholder="密码" />
                </div>
              </div>

              {/* S3 */}
              <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-6 shadow-sm">
                <h3 className="mb-4 text-lg font-semibold text-slate-100">S3 兼容存储</h3>
                <div className="space-y-4">
                  <InputField label="端点" name="S3_ENDPOINT" placeholder="https://s3.example.com" />
                  <PasswordField label="访问密钥 (Access Key)" name="S3_ACCESS_KEY" placeholder="访问密钥" />
                  <PasswordField label="秘密密钥 (Secret Key)" name="S3_SECRET_KEY" placeholder="秘密密钥" />
                  <InputField label="桶名称" name="S3_BUCKET" placeholder="bucket-name" />
                  <InputField label="区域 (Region)" name="S3_REGION" placeholder="us-east-1" />
                </div>
              </div>

              {/* Backblaze B2 */}
              <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-6 shadow-sm">
                <h3 className="mb-4 text-lg font-semibold text-slate-100">Backblaze B2</h3>
                <div className="space-y-4">
                  <PasswordField label="应用密钥 ID" name="B2_APP_KEY_ID" placeholder="应用密钥 ID" />
                  <PasswordField label="应用密钥" name="B2_APP_KEY" placeholder="应用密钥" />
                  <InputField label="桶 ID" name="B2_BUCKET_ID" placeholder="桶 ID" />
                </div>
              </div>

              {/* Gofile */}
              <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-6 shadow-sm">
                <h3 className="mb-4 text-lg font-semibold text-slate-100">Gofile</h3>
                <div className="space-y-4">
                  <PasswordField label="API 密钥" name="GOFILE_API_KEY" placeholder="Gofile API 密钥" />
                  <InputField label="文件夹 ID" name="GOFILE_FOLDER_ID" placeholder="默认文件夹 ID（可选）" />
                </div>
              </div>

              {/* OpenList */}
              <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-6 shadow-sm">
                <h3 className="mb-4 text-lg font-semibold text-slate-100">OpenList</h3>
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
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.WDM_BG_ENABLED === true || formData.WDM_BG_ENABLED === '1'}
                    onChange={(e) => handleFieldChange('WDM_BG_ENABLED', e.target.checked)}
                    className="h-5 w-5 cursor-pointer rounded border-slate-600 bg-slate-700 text-blue-600 transition-colors hover:bg-slate-600 focus:ring-2 focus:ring-blue-500/20"
                  />
                  <span className="text-sm font-medium text-slate-300">启用自定义背景</span>
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
                      <label className="block text-sm font-medium text-slate-300">不透明度</label>
                      <input
                        type="number"
                        min="0"
                        max="1"
                        step="0.1"
                        value={Number(formData.WDM_BG_OPACITY || 1)}
                        onChange={(e) => handleFieldChange('WDM_BG_OPACITY', parseFloat(e.target.value))}
                        className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-slate-100 transition-colors hover:border-slate-600 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 border-t border-slate-800 pt-6">
          <button
            onClick={handleSaveConfig}
            disabled={isSaving}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={18} />
            保存配置
          </button>
          <button
            onClick={fetchConfig}
            className="flex items-center gap-2 rounded-lg border border-slate-700 px-6 py-2.5 font-medium text-slate-300 transition-colors hover:bg-slate-800"
          >
            <RotateCcw size={18} />
            重新加载
          </button>
        </div>
      </div>
    </div>
  );
}
