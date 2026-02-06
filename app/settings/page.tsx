'use client';

import { useState, useEffect, useCallback } from 'react';
import { Form, Input, Button, Card, Typography, Space, message, Tabs, Popconfirm } from 'antd';
import { Settings, Cloud, Database, Trash2, Save, HardDrive } from 'lucide-react';

const { Title, Text } = Typography;

export default function SettingsPage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchConfigs = useCallback(async () => {
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const data = await res.json();
        form.setFieldsValue(data);
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

  const onFinish = async (values: Record<string, string>) => {
    setSaving(true);
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      if (res.ok) {
        message.success('设置已保存');
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
                  <Card title="Redis 记录" className="bg-slate-900/50 border-slate-800">
                    <Form.Item label="Redis URL" name="REDIS_URL" extra="用于分布式任务状态同步（可选）">
                      <Input placeholder="redis://default:password@host:port" className="bg-black border-slate-700 rounded-lg" />
                    </Form.Item>
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