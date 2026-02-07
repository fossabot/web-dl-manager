'use client';

import { useState, useEffect, useCallback } from 'react';
import { Form, Input, Button, Card, Typography, Space, message, Tabs, Popconfirm, Switch, Select, Slider, InputNumber } from 'antd';
import { Settings, Cloud, Database, Trash2, Save, HardDrive, Palette } from 'lucide-react';
import { validateBackgroundURL } from '@/lib/background-manager';

const { Title, Text } = Typography;

export default function SettingsPage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [backgroundEnabled, setBackgroundEnabled] = useState(false);
  const [backgroundType, setBackgroundType] = useState<'image' | 'video'>('image');

  const fetchConfigs = useCallback(async () => {
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const data = await res.json();
        form.setFieldsValue(data);
        
        // Parse background config if it exists
        if (data.WDM_BG_CONFIG) {
          try {
            const bgConfig = JSON.parse(data.WDM_BG_CONFIG);
            setBackgroundEnabled(bgConfig.enabled);
            setBackgroundType(bgConfig.type);
            form.setFieldValue('WDM_BG_ENABLED', bgConfig.enabled);
            form.setFieldValue('WDM_BG_TYPE', bgConfig.type);
            form.setFieldValue('WDM_BG_URL', bgConfig.url);
            form.setFieldValue('WDM_BG_OPACITY', bgConfig.opacity);
            form.setFieldValue('WDM_BG_FIT', bgConfig.fit);
            form.setFieldValue('WDM_BG_POSITION', bgConfig.position);
            form.setFieldValue('WDM_BG_BLUR', bgConfig.blur || 0);
          } catch {
            // Invalid JSON, ignore
          }
        }
      }
    } catch {
      message.error('获取配置失败');
    } finally {
      setLoading(false);
    }
  }, [form]);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  const onFinish = async (values: Record<string, unknown>) => {
    // Validate background URL if enabled
    const bgEnabled = values.WDM_BG_ENABLED;
    if (bgEnabled) {
      const bgUrl = values.WDM_BG_URL as string;
      const bgType = values.WDM_BG_TYPE as 'image' | 'video';
      
      if (!bgUrl) {
        message.error('请输入背景 URL');
        return;
      }

      if (!validateBackgroundURL(bgUrl, bgType)) {
        message.error(`请输入有效的${bgType === 'image' ? '图片' : '视频'} URL (支持 http/https)`);
        return;
      }
    }

    // Prepare background config
    const bgConfig = {
      enabled: values.WDM_BG_ENABLED,
      type: values.WDM_BG_TYPE,
      url: values.WDM_BG_URL,
      opacity: values.WDM_BG_OPACITY || 1,
      fit: values.WDM_BG_FIT || 'cover',
      position: values.WDM_BG_POSITION || 'center',
      blur: values.WDM_BG_BLUR || 0,
    };

    // Remove individual background fields and add composite config
    const configToSave = { ...values };
    delete configToSave.WDM_BG_ENABLED;
    delete configToSave.WDM_BG_TYPE;
    delete configToSave.WDM_BG_URL;
    delete configToSave.WDM_BG_OPACITY;
    delete configToSave.WDM_BG_FIT;
    delete configToSave.WDM_BG_POSITION;
    delete configToSave.WDM_BG_BLUR;
    configToSave.WDM_BG_CONFIG = JSON.stringify(bgConfig);

    setSaving(true);
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configToSave),
      });

      if (res.ok) {
        message.success('设置已保存');
        // Reload page to apply background changes
        setTimeout(() => window.location.reload(), 500);
      } else {
        message.error('保存失败');
      }
    } catch {
      message.error('请求出错');
    } finally {
      setSaving(false);
    }
  };

  const handleCleanupDB = async () => {
    try {
      const res = await fetch('/api/database/cleanup', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        message.success(data.message);
      }
    } catch {
      message.error('清理失败');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><Settings className="animate-spin text-blue-500" /></div>;
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <header className="mb-10 flex justify-between items-end">
        <div>
          <Title level={2} className="m-0 flex items-center">
            <Settings className="mr-3 text-blue-500" /> 系统设置
          </Title>
          <Text type="secondary">管理存储服务、网络隧道及系统参数</Text>
        </div>
        <Button 
          type="primary"
          onClick={() => form.submit()} 
          loading={saving}
          icon={<Save size={18} />}
          style={{ 
            height: 48, 
            borderRadius: 24, 
            padding: '0 32px',
            background: 'linear-gradient(to right, #4facfe 0%, #00f2fe 100%)',
            border: 'none',
            fontWeight: 'bold'
          }}
        >
          保存所有更改
        </Button>
      </header>

      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        className="bg-transparent"
      >
        <Tabs
          defaultActiveKey="1"
          tabPosition="left"
          items={[
            {
              key: '1',
              label: <Space><Cloud size={16}/><span>通用与网络</span></Space>,
              children: (
                <div className="pl-8 space-y-6">
                  <Card title="Cloudflare Tunnel" className="bg-slate-900/50 border-slate-800">
                    <Form.Item label="Tunnel Token" name="TUNNEL_TOKEN" extra="用于内网穿透发布服务">
                      <Input.Password placeholder="your-token-here" className="bg-black border-slate-700 rounded-lg" />
                    </Form.Item>
                  </Card>
                  <Card title="下载引擎配置" className="bg-slate-900/50 border-slate-800">
                    <Form.Item label="Gallery-dl 额外参数" name="WDM_GALLERY_DL_ARGS">
                      <Input placeholder="--cookies-from-browser chrome" className="bg-black border-slate-700 rounded-lg" />
                    </Form.Item>
                    <div className="grid grid-cols-2 gap-4">
                      <Form.Item label="Kemono 用户名" name="WDM_KEMONO_USERNAME">
                        <Input className="bg-black border-slate-700 rounded-lg" />
                      </Form.Item>
                      <Form.Item label="Kemono 密码" name="WDM_KEMONO_PASSWORD">
                        <Input.Password className="bg-black border-slate-700 rounded-lg" />
                      </Form.Item>
                    </div>
                  </Card>
                </div>
              ),
            },
            {
              key: '2',
              label: <Space><HardDrive size={16}/><span>存储服务</span></Space>,
              children: (
                <div className="pl-8 space-y-6">
                  <Card title="WebDAV" className="bg-slate-900/50 border-slate-800">
                    <Form.Item label="服务器 URL" name="WDM_WEBDAV_URL">
                      <Input placeholder="https://dav.example.com" className="bg-black border-slate-700 rounded-lg" />
                    </Form.Item>
                    <div className="grid grid-cols-2 gap-4">
                      <Form.Item label="用户名" name="WDM_WEBDAV_USER">
                        <Input className="bg-black border-slate-700 rounded-lg" />
                      </Form.Item>
                      <Form.Item label="密码" name="WDM_WEBDAV_PASS">
                        <Input.Password className="bg-black border-slate-700 rounded-lg" />
                      </Form.Item>
                    </div>
                  </Card>
                  <Card title="S3 兼容存储" className="bg-slate-900/50 border-slate-800">
                    <div className="grid grid-cols-2 gap-4">
                      <Form.Item label="提供商" name="WDM_S3_PROVIDER"><Input className="bg-black border-slate-700 rounded-lg" /></Form.Item>
                      <Form.Item label="区域" name="WDM_S3_REGION"><Input className="bg-black border-slate-700 rounded-lg" /></Form.Item>
                    </div>
                    <Form.Item label="端点 URL" name="WDM_S3_ENDPOINT"><Input className="bg-black border-slate-700 rounded-lg" /></Form.Item>
                    <div className="grid grid-cols-2 gap-4">
                      <Form.Item label="Access Key" name="WDM_S3_ACCESS_KEY_ID"><Input className="bg-black border-slate-700 rounded-lg" /></Form.Item>
                      <Form.Item label="Secret Key" name="WDM_S3_SECRET_ACCESS_KEY"><Input.Password className="bg-black border-slate-700 rounded-lg" /></Form.Item>
                    </div>
                  </Card>
                </div>
              ),
            },
            {
              key: '3',
              label: <Space><Database size={16}/><span>系统维护</span></Space>,
              children: (
                <div className="pl-8 space-y-6">
                  <Card title="数据库清理" className="bg-slate-900/50 border-slate-800">
                    <Text type="secondary" className="block mb-4">清理数据库中不再使用的废弃配置项，保持系统整洁。</Text>
                    <Popconfirm title="确定要清理吗？" onConfirm={handleCleanupDB}>
                      <Button danger icon={<Trash2 size={16} />} className="rounded-lg">执行数据库维护</Button>
                    </Popconfirm>
                  </Card>
                  <Card title="数据库配置" className="bg-slate-900/50 border-slate-800">
                    <Form.Item label="Redis URL" name="REDIS_URL" extra="仅用于向后兼容。建议使用 DATABASE_URL 配置 Redis。支持格式: redis://[password@]host:port[/db]">
                      <Input placeholder="redis://default:password@host:port" className="bg-black border-slate-700 rounded-lg" />
                    </Form.Item>
                  </Card>
                </div>
              ),
            },
            {
              key: '4',
              label: <Space><Palette size={16}/><span>背景设置</span></Space>,
              children: (
                <div className="pl-8 space-y-6">
                  <Card title="自定义背景" className="bg-slate-900/50 border-slate-800">
                    <Text type="secondary" className="block mb-6">为应用添加自定义背景，支持外链图片或视频。</Text>
                    
                    <Form.Item label="启用自定义背景" name="WDM_BG_ENABLED" valuePropName="checked">
                      <Switch 
                        onChange={(checked) => setBackgroundEnabled(checked)}
                      />
                    </Form.Item>

                    {backgroundEnabled && (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <Form.Item label="背景类型" name="WDM_BG_TYPE">
                            <Select 
                              options={[
                                { label: '图片', value: 'image' },
                                { label: '视频', value: 'video' },
                              ]}
                              onChange={(value) => setBackgroundType(value)}
                              className="bg-black border-slate-700 rounded-lg"
                            />
                          </Form.Item>

                          <Form.Item label="适配方式" name="WDM_BG_FIT">
                            <Select 
                              defaultValue="cover"
                              options={[
                                { label: '填充 (cover)', value: 'cover' },
                                { label: '包含 (contain)', value: 'contain' },
                                { label: '拉伸 (fill)', value: 'fill' },
                              ]}
                            />
                          </Form.Item>
                        </div>

                        <Form.Item 
                          label={`${backgroundType === 'image' ? '图片' : '视频'} URL`}
                          name="WDM_BG_URL" 
                          extra={`输入有效的 HTTP/HTTPS ${backgroundType === 'image' ? '图片' : '视频'}链接 (支持: ${backgroundType === 'image' ? 'jpg, png, gif, webp' : 'mp4, webm, ogg'})`}
                          rules={[
                            { required: true, message: '请输入 URL' }
                          ]}
                        >
                          <Input 
                            placeholder={backgroundType === 'image' ? 'https://example.com/bg.jpg' : 'https://example.com/bg.mp4'} 
                            className="bg-black border-slate-700 rounded-lg"
                          />
                        </Form.Item>

                        <div className="grid grid-cols-3 gap-4">
                          <Form.Item label="背景位置" name="WDM_BG_POSITION">
                            <Select 
                              defaultValue="center"
                              options={[
                                { label: '左上', value: 'top left' },
                                { label: '上中', value: 'top center' },
                                { label: '右上', value: 'top right' },
                                { label: '左中', value: 'center left' },
                                { label: '中心', value: 'center' },
                                { label: '右中', value: 'center right' },
                                { label: '左下', value: 'bottom left' },
                                { label: '下中', value: 'bottom center' },
                                { label: '右下', value: 'bottom right' },
                              ]}
                            />
                          </Form.Item>

                          <Form.Item label="不透明度" name="WDM_BG_OPACITY">
                            <InputNumber 
                              min={0} 
                              max={1} 
                              step={0.1}
                              defaultValue={1}
                              className="w-full"
                            />
                          </Form.Item>

                          <Form.Item label="模糊程度 (px)" name="WDM_BG_BLUR">
                            <Slider 
                              min={0} 
                              max={20} 
                              step={1}
                              defaultValue={0}
                              marks={{ 0: '0', 10: '10', 20: '20' }}
                            />
                          </Form.Item>
                        </div>

                        <div className="mt-4 p-4 bg-blue-900/20 border border-blue-700/50 rounded-lg">
                          <Text type="secondary" className="text-xs">
                            💡 提示：背景会应用到整个应用界面。建议使用高质量的外链资源以获得最佳效果。
                          </Text>
                        </div>
                      </>
                    )}
                  </Card>
                </div>
              ),
            },
          ]}
        />
      </Form>
    </div>
  );
}