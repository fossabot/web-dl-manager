'use client';

import { useState, useEffect, useCallback } from 'react';
import { Settings, Cloud, Database, Trash2, Save, HardDrive, Palette, Loader2 } from 'lucide-react';
import { validateBackgroundURL } from '@/lib/background-manager';

interface TabConfig {
  key: string;
  label: string;
  icon: React.ReactNode;
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('1');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [backgroundEnabled, setBackgroundEnabled] = useState(false);
  const [backgroundType, setBackgroundType] = useState<'image' | 'video'>('image');
  const [bgBlur, setBgBlur] = useState(0);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [formData, setFormData] = useState<Record<string, string | boolean | number>>({
    TUNNEL_TOKEN: '',
    WDM_GALLERY_DL_ARGS: '',
    WDM_KEMONO_USERNAME: '',
    WDM_KEMONO_PASSWORD: '',
    WDM_WEBDAV_URL: '',
    WDM_WEBDAV_USER: '',
    WDM_WEBDAV_PASS: '',
    WDM_S3_PROVIDER: '',
    WDM_S3_REGION: '',
    WDM_S3_ENDPOINT: '',
    WDM_S3_ACCESS_KEY_ID: '',
    WDM_S3_SECRET_ACCESS_KEY: '',
    REDIS_URL: '',
    WDM_BG_ENABLED: false,
    WDM_BG_TYPE: 'image',
    WDM_BG_URL: '',
    WDM_BG_OPACITY: 1,
    WDM_BG_FIT: 'cover',
    WDM_BG_POSITION: 'center',
    WDM_BG_BLUR: 0,
  });

  const fetchConfigs = useCallback(async () => {
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const data = await res.json();
        setFormData(prev => ({ ...prev, ...data }));
        
        if (data.WDM_BG_CONFIG) {
          try {
            const bgConfig = JSON.parse(data.WDM_BG_CONFIG);
            setBackgroundEnabled(bgConfig.enabled);
            setBackgroundType(bgConfig.type);
            setBgBlur(bgConfig.blur || 0);
            setFormData(prev => ({
              ...prev,
              WDM_BG_ENABLED: bgConfig.enabled,
              WDM_BG_TYPE: bgConfig.type,
              WDM_BG_URL: bgConfig.url,
              WDM_BG_OPACITY: bgConfig.opacity,
              WDM_BG_FIT: bgConfig.fit,
              WDM_BG_POSITION: bgConfig.position,
              WDM_BG_BLUR: bgConfig.blur || 0,
            }));
          } catch {
            // Invalid JSON, ignore
          }
        }
      }
    } catch {
      showMessage('error', '获取配置失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleInputChange = (key: string, value: string | number | boolean) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const onFinish = async () => {
    if (backgroundEnabled) {
      const bgUrl = formData.WDM_BG_URL as string;
      const bgTypeVal = formData.WDM_BG_TYPE as 'image' | 'video';
      
      if (!bgUrl) {
        showMessage('error', '请输入背景 URL');
        return;
      }

      if (!validateBackgroundURL(bgUrl, bgTypeVal)) {
        showMessage('error', `请输入有效的${bgTypeVal === 'image' ? '图片' : '视频'} URL (支持 http/https)`);
        return;
      }
    }

    const bgConfig = {
      enabled: formData.WDM_BG_ENABLED,
      type: formData.WDM_BG_TYPE,
      url: formData.WDM_BG_URL,
      opacity: formData.WDM_BG_OPACITY || 1,
      fit: formData.WDM_BG_FIT || 'cover',
      position: formData.WDM_BG_POSITION || 'center',
      blur: formData.WDM_BG_BLUR || 0,
    };

    const configToSave = { ...formData };
    delete configToSave.WDM_BG_ENABLED;
    delete configToSave.WDM_BG_TYPE;
    delete configToSave.WDM_BG_URL;
    delete configToSave.WDM_BG_OPACITY;
    delete configToSave.WDM_BG_FIT;
    delete configToSave.WDM_BG_POSITION;
    delete configToSave.WDM_BG_BLUR;
    (configToSave as Record<string, string>).WDM_BG_CONFIG = JSON.stringify(bgConfig);

    setSaving(true);
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configToSave),
      });

      if (res.ok) {
        showMessage('success', '设置已保存');
        setTimeout(() => window.location.reload(), 500);
      } else {
        showMessage('error', '保存失败');
      }
    } catch {
      showMessage('error', '请求出错');
    } finally {
      setSaving(false);
    }
  };

  const handleCleanupDB = async () => {
    if (!window.confirm('确定要清理数据库吗？')) return;
    try {
      const res = await fetch('/api/database/cleanup', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        showMessage('success', data.message);
      }
    } catch {
      showMessage('error', '清理失败');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin text-blue-500" size={40} />
      </div>
    );
  }

  const tabs: TabConfig[] = [
    { key: '1', label: '通用与网络', icon: <Cloud size={16} /> },
    { key: '2', label: '存储服务', icon: <HardDrive size={16} /> },
    { key: '3', label: '系统维护', icon: <Database size={16} /> },
    { key: '4', label: '背景设置', icon: <Palette size={16} /> },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 md:py-12">
      {/* Message Toast */}
      {message && (
        <div className={`fixed top-4 right-4 px-4 py-3 rounded-lg text-sm font-medium z-50 ${
          message.type === 'success'
            ? 'bg-green-900/50 border border-green-700/50 text-green-400'
            : 'bg-red-900/50 border border-red-700/50 text-red-400'
        }`}>
          {message.text}
        </div>
      )}

      <header className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2 mb-2">
            <Settings className="text-blue-500" size={28} /> 系统设置
          </h1>
          <p className="text-slate-400 text-sm md:text-base">管理存储服务、网络隧道及系统参数</p>
        </div>
        <button 
          onClick={onFinish} 
          disabled={saving}
          className="w-full sm:w-auto px-6 py-2.5 md:py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white rounded-lg transition-all font-medium flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          保存所有更改
        </button>
      </header>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Tab Navigation */}
        <div className="flex md:flex-col gap-2 overflow-x-auto md:w-40 flex-shrink-0">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-lg transition-colors font-medium text-sm whitespace-nowrap md:whitespace-normal flex items-center gap-2 ${
                activeTab === tab.key
                  ? 'bg-blue-600/20 border border-blue-600 text-blue-400'
                  : 'bg-slate-700/30 hover:bg-slate-700/50 text-slate-300'
              }`}
            >
              {tab.icon} <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1">
          {/* Tab 1: 通用与网络 */}
          {activeTab === '1' && (
            <div className="space-y-6">
              <div className="card-elevated p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Cloud size={18} className="text-blue-500" /> Cloudflare Tunnel
                </h3>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Tunnel Token</label>
                  <p className="text-xs text-slate-500 mb-3">用于内网穿透发布服务</p>
                  <input
                    type="password"
                    value={formData.TUNNEL_TOKEN as string}
                    onChange={(e) => handleInputChange('TUNNEL_TOKEN', e.target.value)}
                    placeholder="your-token-here"
                    className="input-base"
                  />
                </div>
              </div>

              <div className="card-elevated p-6">
                <h3 className="text-lg font-semibold mb-4">下载引擎配置</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Gallery-dl 额外参数</label>
                    <input
                      type="text"
                      value={formData.WDM_GALLERY_DL_ARGS as string}
                      onChange={(e) => handleInputChange('WDM_GALLERY_DL_ARGS', e.target.value)}
                      placeholder="--cookies-from-browser chrome"
                      className="input-base"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Kemono 用户名</label>
                      <input
                        type="text"
                        value={formData.WDM_KEMONO_USERNAME as string}
                        onChange={(e) => handleInputChange('WDM_KEMONO_USERNAME', e.target.value)}
                        className="input-base"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Kemono 密码</label>
                      <input
                        type="password"
                        value={formData.WDM_KEMONO_PASSWORD as string}
                        onChange={(e) => handleInputChange('WDM_KEMONO_PASSWORD', e.target.value)}
                        className="input-base"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: 存储服务 */}
          {activeTab === '2' && (
            <div className="space-y-6">
              <div className="card-elevated p-6">
                <h3 className="text-lg font-semibold mb-4">WebDAV</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">服务器 URL</label>
                    <input
                      type="text"
                      value={formData.WDM_WEBDAV_URL as string}
                      onChange={(e) => handleInputChange('WDM_WEBDAV_URL', e.target.value)}
                      placeholder="https://dav.example.com"
                      className="input-base"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">用户名</label>
                      <input
                        type="text"
                        value={formData.WDM_WEBDAV_USER as string}
                        onChange={(e) => handleInputChange('WDM_WEBDAV_USER', e.target.value)}
                        className="input-base"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">密码</label>
                      <input
                        type="password"
                        value={formData.WDM_WEBDAV_PASS as string}
                        onChange={(e) => handleInputChange('WDM_WEBDAV_PASS', e.target.value)}
                        className="input-base"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="card-elevated p-6">
                <h3 className="text-lg font-semibold mb-4">S3 兼容存储</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">提供商</label>
                      <input
                        type="text"
                        value={formData.WDM_S3_PROVIDER as string}
                        onChange={(e) => handleInputChange('WDM_S3_PROVIDER', e.target.value)}
                        className="input-base"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">区域</label>
                      <input
                        type="text"
                        value={formData.WDM_S3_REGION as string}
                        onChange={(e) => handleInputChange('WDM_S3_REGION', e.target.value)}
                        className="input-base"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">端点 URL</label>
                    <input
                      type="text"
                      value={formData.WDM_S3_ENDPOINT as string}
                      onChange={(e) => handleInputChange('WDM_S3_ENDPOINT', e.target.value)}
                      className="input-base"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Access Key</label>
                      <input
                        type="text"
                        value={formData.WDM_S3_ACCESS_KEY_ID as string}
                        onChange={(e) => handleInputChange('WDM_S3_ACCESS_KEY_ID', e.target.value)}
                        className="input-base"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Secret Key</label>
                      <input
                        type="password"
                        value={formData.WDM_S3_SECRET_ACCESS_KEY as string}
                        onChange={(e) => handleInputChange('WDM_S3_SECRET_ACCESS_KEY', e.target.value)}
                        className="input-base"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: 系统维护 */}
          {activeTab === '3' && (
            <div className="space-y-6">
              <div className="card-elevated p-6">
                <h3 className="text-lg font-semibold mb-4">数据库清理</h3>
                <p className="text-sm text-slate-400 mb-4">清理数据库中不再使用的废弃配置项，保持系统整洁。</p>
                <button
                  onClick={handleCleanupDB}
                  className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 hover:text-red-300 rounded-lg transition-colors font-medium flex items-center gap-2 border border-red-700/50"
                >
                  <Trash2 size={16} /> 执行数据库维护
                </button>
              </div>

              <div className="card-elevated p-6">
                <h3 className="text-lg font-semibold mb-4">数据库配置</h3>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Redis URL</label>
                  <p className="text-xs text-slate-500 mb-3">仅用于向后兼容。建议使用 DATABASE_URL 配置 Redis。支持格式: redis://[password@]host:port[/db]</p>
                  <input
                    type="text"
                    value={formData.REDIS_URL as string}
                    onChange={(e) => handleInputChange('REDIS_URL', e.target.value)}
                    placeholder="redis://default:password@host:port"
                    className="input-base"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Tab 4: 背景设置 */}
          {activeTab === '4' && (
            <div className="card-elevated p-6">
              <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                <Palette size={18} className="text-blue-500" /> 自定义背景
              </h3>
              <p className="text-sm text-slate-400 mb-6">为应用添加自定义背景，支持外链图片或视频。</p>

              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="bg-enabled"
                    checked={backgroundEnabled}
                    onChange={(e) => {
                      setBackgroundEnabled(e.target.checked);
                      handleInputChange('WDM_BG_ENABLED', e.target.checked);
                    }}
                    className="w-4 h-4 rounded accent-blue-600"
                  />
                  <label htmlFor="bg-enabled" className="text-sm font-medium text-slate-300">启用自定义背景</label>
                </div>

                {backgroundEnabled && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">背景类型</label>
                        <select
                          value={backgroundType}
                          onChange={(e) => {
                            setBackgroundType(e.target.value as 'image' | 'video');
                            handleInputChange('WDM_BG_TYPE', e.target.value);
                          }}
                          className="input-base"
                        >
                          <option value="image">图片</option>
                          <option value="video">视频</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">适配方式</label>
                        <select
                          value={formData.WDM_BG_FIT as string}
                          onChange={(e) => handleInputChange('WDM_BG_FIT', e.target.value)}
                          className="input-base"
                        >
                          <option value="cover">填充 (cover)</option>
                          <option value="contain">包含 (contain)</option>
                          <option value="fill">拉伸 (fill)</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        {backgroundType === 'image' ? '图片' : '视频'} URL
                      </label>
                      <p className="text-xs text-slate-500 mb-2">
                        输入有效的 HTTP/HTTPS {backgroundType === 'image' ? '图片' : '视频'}链接 (支持: {backgroundType === 'image' ? 'jpg, png, gif, webp' : 'mp4, webm, ogg'})
                      </p>
                      <input
                        type="text"
                        value={formData.WDM_BG_URL as string}
                        onChange={(e) => handleInputChange('WDM_BG_URL', e.target.value)}
                        placeholder={backgroundType === 'image' ? 'https://example.com/bg.jpg' : 'https://example.com/bg.mp4'}
                        className="input-base"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">背景位置</label>
                        <select
                          value={formData.WDM_BG_POSITION as string}
                          onChange={(e) => handleInputChange('WDM_BG_POSITION', e.target.value)}
                          className="input-base"
                        >
                          <option value="top left">左上</option>
                          <option value="top center">上中</option>
                          <option value="top right">右上</option>
                          <option value="center left">左中</option>
                          <option value="center">中心</option>
                          <option value="center right">右中</option>
                          <option value="bottom left">左下</option>
                          <option value="bottom center">下中</option>
                          <option value="bottom right">右下</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">不透明度</label>
                        <input
                          type="number"
                          min="0"
                          max="1"
                          step="0.1"
                          value={formData.WDM_BG_OPACITY as number}
                          onChange={(e) => {
                            handleInputChange('WDM_BG_OPACITY', parseFloat(e.target.value));
                          }}
                          className="input-base"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">模糊程度 ({bgBlur}px)</label>
                        <input
                          type="range"
                          min="0"
                          max="20"
                          step="1"
                          value={bgBlur}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            setBgBlur(val);
                            handleInputChange('WDM_BG_BLUR', val);
                          }}
                          className="w-full accent-blue-600"
                        />
                      </div>
                    </div>

                    <div className="p-4 bg-blue-900/20 border border-blue-700/50 rounded-lg">
                      <p className="text-xs text-blue-300">
                        💡 提示：背景会应用到整个应用界面。建议使用高质量的外链资源以获得最佳效果。
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}