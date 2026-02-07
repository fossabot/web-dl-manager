'use client';

import { useState, useEffect, useCallback } from 'react';
import { Form, Input, Button, message, Card, Select, Space, Tabs, Row, Col, Switch } from 'antd';
import { SaveOutlined, ReloadOutlined } from '@ant-design/icons';

interface FormData {
  [key: string]: string | number | boolean | undefined;
}

export const dynamic = 'force-dynamic';

export default function SettingsPage() {
  const [form] = Form.useForm();
  const [formData, setFormData] = useState<FormData>({});
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchConfig = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const data = await res.json();
        setFormData(data);
        form.setFieldsValue(data);
      }
    } catch (error) {
      console.error('Failed to fetch config:', error);
      message.error('加载配置失败');
    } finally {
      setLoading(false);
    }
  }, [form]);

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

  const tabItems = [
    {
      key: 'system',
      label: '系统配置',
      children: (
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Form.Item label="应用名称" required>
            <Input
              placeholder="WDM 下载管理器"
              value={String(formData.APP_NAME || '')}
              onChange={(e) => handleFieldChange('APP_NAME', e.target.value)}
            />
          </Form.Item>
          <Form.Item label="应用描述">
            <Input.TextArea
              placeholder="应用描述"
              value={String(formData.APP_DESC || '')}
              onChange={(e) => handleFieldChange('APP_DESC', e.target.value)}
              rows={4}
            />
          </Form.Item>
          <Form.Item label="API 端口">
            <Input
              type="number"
              placeholder="6275"
              value={Number(formData.PORT || 6275)}
              onChange={(e) => handleFieldChange('PORT', parseInt(e.target.value, 10))}
            />
          </Form.Item>
        </Space>
      ),
    },
    {
      key: 'database',
      label: '数据库',
      children: (
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Form.Item label="DATABASE_URL" required>
            <Input.Password
              placeholder="mysql://user:pass@host:3306/db"
              value={String(formData.DATABASE_URL || '')}
              onChange={(e) => handleFieldChange('DATABASE_URL', e.target.value)}
            />
          </Form.Item>
          <div style={{ padding: '12px', backgroundColor: '#e6f7ff', borderRadius: '4px', fontSize: '12px' }}>
            ✅ 支持 MySQL、PostgreSQL、SQLite、Redis
          </div>
        </Space>
      ),
    },
    {
      key: 'redis',
      label: 'Redis',
      children: (
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Form.Item label="REDIS_URL（备用）">
            <Input.Password
              placeholder="redis://localhost:6379"
              value={String(formData.REDIS_URL || '')}
              onChange={(e) => handleFieldChange('REDIS_URL', e.target.value)}
            />
          </Form.Item>
        </Space>
      ),
    },
    {
      key: 'upload',
      label: '上传服务',
      children: (
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Card title="OpenList" size="small">
              <Space direction="vertical" style={{ width: '100%' }}>
                <Form.Item label="API 密钥">
                  <Input.Password
                    placeholder="OpenList API 密钥"
                    value={String(formData.OPENLIST_API_KEY || '')}
                    onChange={(e) => handleFieldChange('OPENLIST_API_KEY', e.target.value)}
                  />
                </Form.Item>
                <Form.Item label="API 端点">
                  <Input
                    placeholder="https://api.openlist.com/upload"
                    value={String(formData.OPENLIST_API_URL || '')}
                    onChange={(e) => handleFieldChange('OPENLIST_API_URL', e.target.value)}
                  />
                </Form.Item>
                <Button
                  type="primary"
                  block
                  onClick={() => {
                    if (formData.OPENLIST_API_KEY) {
                      message.success('✅ OpenList 配置已启用');
                    } else {
                      message.warning('请输入 API 密钥');
                    }
                  }}
                >
                  启用
                </Button>
              </Space>
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card title="Gofile" size="small">
              <Space direction="vertical" style={{ width: '100%' }}>
                <Form.Item label="API 密钥">
                  <Input.Password
                    placeholder="Gofile API 密钥"
                    value={String(formData.GOFILE_API_KEY || '')}
                    onChange={(e) => handleFieldChange('GOFILE_API_KEY', e.target.value)}
                  />
                </Form.Item>
                <Form.Item label="文件夹 ID">
                  <Input
                    placeholder="默认文件夹 ID（可选）"
                    value={String(formData.GOFILE_FOLDER_ID || '')}
                    onChange={(e) => handleFieldChange('GOFILE_FOLDER_ID', e.target.value)}
                  />
                </Form.Item>
                <Button
                  type="primary"
                  block
                  onClick={() => {
                    if (formData.GOFILE_API_KEY) {
                      message.success('✅ Gofile 配置已启用');
                    } else {
                      message.warning('请输入 API 密钥');
                    }
                  }}
                >
                  启用
                </Button>
              </Space>
            </Card>
          </Col>
        </Row>
      ),
    },
    {
      key: 'background',
      label: '自定义背景',
      children: (
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Form.Item label="启用自定义背景">
            <Switch
              checked={formData.WDM_BG_ENABLED === true || formData.WDM_BG_ENABLED === '1'}
              onChange={(checked) => handleFieldChange('WDM_BG_ENABLED', checked)}
            />
          </Form.Item>

          {(formData.WDM_BG_ENABLED === true || formData.WDM_BG_ENABLED === '1') && (
            <>
              <Form.Item label="背景资源 URL">
                <Input.TextArea
                  placeholder="输入图片或视频的外链 URL"
                  value={String(formData.WDM_BG_URL || '')}
                  onChange={(e) => handleFieldChange('WDM_BG_URL', e.target.value)}
                  rows={3}
                />
              </Form.Item>

              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item label="覆盖类型">
                    <Select
                      value={String(formData.WDM_BG_POSITION || 'center')}
                      onChange={(value) => handleFieldChange('WDM_BG_POSITION', value)}
                    >
                      <Select.Option value="center">居中</Select.Option>
                      <Select.Option value="cover">铺满</Select.Option>
                      <Select.Option value="contain">包含</Select.Option>
                      <Select.Option value="stretch">拉伸</Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item label="不透明度">
                    <Input
                      type="number"
                      min="0"
                      max="1"
                      step="0.1"
                      value={Number(formData.WDM_BG_OPACITY || 1)}
                      onChange={(e) => handleFieldChange('WDM_BG_OPACITY', parseFloat(e.target.value))}
                    />
                  </Form.Item>
                </Col>
              </Row>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Card title="系统设置" loading={loading}>
        <Tabs items={tabItems} style={{ marginBottom: '24px' }} />

        <Space>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={isSaving}
            onClick={handleSaveConfig}
          >
            保存配置
          </Button>
          <Button icon={<ReloadOutlined />} onClick={fetchConfig}>
            重新加载
          </Button>
        </Space>
      </Card>
    </div>
  );
}
