'use client';

import { useState } from 'react';
import { Form, Input, Select, Switch, InputNumber, Button, Card, Typography, Space, Divider, message } from 'antd';
import { CloudDownloadOutlined, SettingOutlined, RocketOutlined } from '@ant-design/icons';
import { GradientButton } from '@lobehub/ui';

const { Title, Text } = Typography;
const { TextArea } = Input;

export default function DownloaderPage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [uploadService, setUploadService] = useState('');

  const onFinish = async (values: any) => {
    setLoading(true);
    const formData = new FormData();
    Object.entries(values).forEach(([key, value]: [string, any]) => {
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
        form.resetFields(['url']);
      } else {
        message.error(data.error || '任务启动失败');
      }
    } catch (err) {
      message.error('请求发生错误');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <header className="mb-12 text-center">
        <Title level={1} style={{ marginBottom: 8, background: 'linear-gradient(to right, #4facfe 0%, #00f2fe 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          下载管理器
        </Title>
        <Text type="secondary">从各种站点下载图片和视频，并自动备份至云存储</Text>
      </header>

      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        initialValues={{
          downloader: 'gallery-dl',
          enable_compression: true,
          split_compression: false,
          split_size: 1000
        }}
        onValuesChange={(changedValues) => {
          if (changedValues.upload_service !== undefined) {
            setUploadService(changedValues.upload_service);
          }
        }}
      >
        <Space direction="vertical" size="large" className="w-full">
          {/* Step 1 */}
          <Card 
            title={<Space><CloudDownloadOutlined /><span>步骤 1：下载设置</span></Space>}
            className="shadow-sm border-slate-800"
            styles={{ header: { borderBottom: '1px solid #1e293b' } }}
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Form.Item label="下载引擎" name="downloader" className="md:col-span-1">
                <Select size="large">
                  <option value="gallery-dl">Gallery-DL</option>
                  <option value="kemono-dl">Kemono-DL (Pro)</option>
                  <option value="megadl">Mega-DL</option>
                </Select>
              </Form.Item>
              <Form.Item 
                label="目标 URL (每行一个)" 
                name="url" 
                className="md:col-span-2"
                rules={[{ required: true, message: '请输入目标 URL' }]}
              >
                <TextArea
                  rows={5}
                  placeholder="https://example.com/user/123"
                  className="font-mono text-sm"
                />
              </Form.Item>
            </div>
          </Card>

          {/* Step 2 */}
          <Card 
            title={<Space><RocketOutlined /><span>步骤 2：上传设置</span></Space>}
            className="shadow-sm border-slate-800"
            styles={{ header: { borderBottom: '1px solid #1e293b' } }}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Form.Item label="目标服务" name="upload_service" rules={[{ required: true, message: '请选择上传服务' }]}>
                <Select size="large" placeholder="选择存储服务">
                  <Select.Option value="webdav">WebDAV</Select.Option>
                  <Select.Option value="s3">S3 兼容存储</Select.Option>
                  <Select.Option value="b2">Backblaze B2</Select.Option>
                  <Select.Option value="gofile">Gofile.io</Select.Option>
                  <Select.Option value="openlist">Openlist</Select.Option>
                </Select>
              </Form.Item>
              {uploadService !== 'gofile' && (
                <Form.Item label="远程路径" name="upload_path">
                  <Input size="large" placeholder="/downloads/images" />
                </Form.Item>
              )}
            </div>
          </Card>

          {/* Step 3 */}
          <Card 
            title={<Space><SettingOutlined /><span>步骤 3：高级选项</span></Space>}
            className="shadow-sm border-slate-800"
            styles={{ header: { borderBottom: '1px solid #1e293b' } }}
          >
            <div className="space-y-6">
              <div className="flex flex-wrap gap-12">
                <Form.Item name="enable_compression" valuePropName="checked" noStyle>
                  <Switch checkedChildren="启用压缩" unCheckedChildren="禁用压缩" />
                </Form.Item>
                <Form.Item name="split_compression" valuePropName="checked" noStyle>
                  <Switch checkedChildren="分卷压缩" unCheckedChildren="分卷压缩" />
                </Form.Item>
              </div>
              
              <Form.Item noStyle shouldUpdate={(prevValues, currentValues) => prevValues.split_compression !== currentValues.split_compression}>
                {({ getFieldValue }) => 
                  getFieldValue('split_compression') ? (
                    <div className="w-full md:w-1/3">
                      <Form.Item label="分卷大小 (MB)" name="split_size">
                        <InputNumber min={1} className="w-full" size="large" />
                      </Form.Item>
                    </div>
                  ) : null
                }
              </Form.Item>
            </div>
          </Card>

          <div className="flex justify-center py-8">
            <Form.Item>
              <GradientButton
                size="large"
                htmlType="submit"
                loading={loading}
                style={{ width: 240, height: 56, borderRadius: 28, fontSize: 18, fontWeight: 'bold' }}
              >
                开始下载任务
              </GradientButton>
            </Form.Item>
          </div>
        </Space>
      </Form>
    </div>
  );
}
