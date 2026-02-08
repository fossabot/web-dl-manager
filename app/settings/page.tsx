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

          {/* 数据库配置提示 */}
          <div style={{ padding: '16px', backgroundColor: 'rgba(13, 110, 253, 0.1)', border: '1px solid #0d6efd', borderRadius: '8px', marginTop: '16px' }}>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#0d6efd', marginBottom: '8px' }}>
              ℹ️ 数据库配置
            </div>
            <div style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.7)', lineHeight: '1.6' }}>
              数据库连接应通过环境变量 <code style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)', padding: '2px 6px', borderRadius: '4px' }}>DATABASE_URL</code> 配置。
              <br />
              <br />
              <strong>支持的数据库类型：</strong>
              <ul style={{ marginTop: '8px', marginBottom: 0, paddingLeft: '20px' }}>
                <li>MySQL: <code style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)', padding: '2px 6px', borderRadius: '4px' }}>mysql://user:pass@host:3306/db</code></li>
                <li>PostgreSQL: <code style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)', padding: '2px 6px', borderRadius: '4px' }}>postgresql://user:pass@host:5432/db</code></li>
                <li>SQLite: <code style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)', padding: '2px 6px', borderRadius: '4px' }}>file:./webdl-manager.db</code></li>
                <li>Redis: <code style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)', padding: '2px 6px', borderRadius: '4px' }}>redis://[:password]@host:port[/db]</code></li>
              </ul>
            </div>
          </div>
        </Space>
      ),
    },
    {
      key: 'upload',
      label: '上传服务',
      children: (
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <div style={{ padding: '16px', backgroundColor: 'rgba(13, 110, 253, 0.1)', border: '1px solid #0d6efd', borderRadius: '8px' }}>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#0d6efd', marginBottom: '8px' }}>
              ℹ️ 上传服务配置
            </div>
            <div style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.7)' }}>
              下载页面中的上传服务选择框会显示所有支持的服务。请根据需要配置相应的服务凭证。
            </div>
          </div>

          <Row gutter={16}>
            {/* WebDAV */}
            <Col xs={24} md={12}>
              <Card title="WebDAV" size="small">
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Form.Item label="服务器地址">
                    <Input
                      placeholder="https://webdav.example.com"
                      value={String(formData.WEBDAV_URL || '')}
                      onChange={(e) => handleFieldChange('WEBDAV_URL', e.target.value)}
                    />
                  </Form.Item>
                  <Form.Item label="用户名">
                    <Input
                      placeholder="用户名"
                      value={String(formData.WEBDAV_USER || '')}
                      onChange={(e) => handleFieldChange('WEBDAV_USER', e.target.value)}
                    />
                  </Form.Item>
                  <Form.Item label="密码">
                    <Input.Password
                      placeholder="密码"
                      value={String(formData.WEBDAV_PASS || '')}
                      onChange={(e) => handleFieldChange('WEBDAV_PASS', e.target.value)}
                    />
                  </Form.Item>
                </Space>
              </Card>
            </Col>

            {/* S3 */}
            <Col xs={24} md={12}>
              <Card title="S3 兼容存储" size="small">
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Form.Item label="端点">
                    <Input
                      placeholder="https://s3.example.com"
                      value={String(formData.S3_ENDPOINT || '')}
                      onChange={(e) => handleFieldChange('S3_ENDPOINT', e.target.value)}
                    />
                  </Form.Item>
                  <Form.Item label="访问密钥 (Access Key)">
                    <Input.Password
                      placeholder="访问密钥"
                      value={String(formData.S3_ACCESS_KEY || '')}
                      onChange={(e) => handleFieldChange('S3_ACCESS_KEY', e.target.value)}
                    />
                  </Form.Item>
                  <Form.Item label="秘密密钥 (Secret Key)">
                    <Input.Password
                      placeholder="秘密密钥"
                      value={String(formData.S3_SECRET_KEY || '')}
                      onChange={(e) => handleFieldChange('S3_SECRET_KEY', e.target.value)}
                    />
                  </Form.Item>
                  <Form.Item label="桶名称">
                    <Input
                      placeholder="bucket-name"
                      value={String(formData.S3_BUCKET || '')}
                      onChange={(e) => handleFieldChange('S3_BUCKET', e.target.value)}
                    />
                  </Form.Item>
                  <Form.Item label="区域 (Region)">
                    <Input
                      placeholder="us-east-1"
                      value={String(formData.S3_REGION || '')}
                      onChange={(e) => handleFieldChange('S3_REGION', e.target.value)}
                    />
                  </Form.Item>
                </Space>
              </Card>
            </Col>

            {/* Backblaze B2 */}
            <Col xs={24} md={12}>
              <Card title="Backblaze B2" size="small">
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Form.Item label="应用密钥 ID">
                    <Input.Password
                      placeholder="应用密钥 ID"
                      value={String(formData.B2_APP_KEY_ID || '')}
                      onChange={(e) => handleFieldChange('B2_APP_KEY_ID', e.target.value)}
                    />
                  </Form.Item>
                  <Form.Item label="应用密钥">
                    <Input.Password
                      placeholder="应用密钥"
                      value={String(formData.B2_APP_KEY || '')}
                      onChange={(e) => handleFieldChange('B2_APP_KEY', e.target.value)}
                    />
                  </Form.Item>
                  <Form.Item label="桶 ID">
                    <Input
                      placeholder="桶 ID"
                      value={String(formData.B2_BUCKET_ID || '')}
                      onChange={(e) => handleFieldChange('B2_BUCKET_ID', e.target.value)}
                    />
                  </Form.Item>
                </Space>
              </Card>
            </Col>

            {/* Gofile */}
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
                </Space>
              </Card>
            </Col>

            {/* OpenList */}
            <Col xs={24} md={12}>
              <Card title="OpenList" size="small">
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Form.Item label="服务器地址">
                    <Input
                      placeholder="https://openlist.example.com"
                      value={String(formData.OPENLIST_URL || '')}
                      onChange={(e) => handleFieldChange('OPENLIST_URL', e.target.value)}
                    />
                  </Form.Item>
                  <Form.Item label="用户名">
                    <Input
                      placeholder="用户名"
                      value={String(formData.OPENLIST_USER || '')}
                      onChange={(e) => handleFieldChange('OPENLIST_USER', e.target.value)}
                    />
                  </Form.Item>
                  <Form.Item label="密码">
                    <Input.Password
                      placeholder="密码"
                      value={String(formData.OPENLIST_PASS || '')}
                      onChange={(e) => handleFieldChange('OPENLIST_PASS', e.target.value)}
                    />
                  </Form.Item>
                </Space>
              </Card>
            </Col>
          </Row>
        </Space>
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
    <div style={{ padding: '24px', minHeight: '100vh', backgroundColor: '#0a0e27' }}>
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
