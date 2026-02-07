'use client';

import { Form, Input, Button, message, Space, Card, Select, Steps } from 'antd';
import { DownloadOutlined, LinkOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { useState } from 'react';

interface FormValues {
  url: string;
  uploadService?: string;
  priority?: string;
}

export const dynamic = 'force-dynamic';

const getPriorityLabel = (priority?: string): string => {
  if (priority === 'low') return '低';
  if (priority === 'high') return '高';
  return '普通';
};

export default function HomePage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [formValues, setFormValues] = useState<FormValues>({ url: '' });

  const handleNext = async (): Promise<void> => {
    if (step === 0) {
      form.validateFields(['url']).then(() => setStep(1));
    } else if (step === 1) {
      setStep(2);
    }
  };

  const handlePrev = (): void => {
    setStep(step - 1);
  };

  const handleSubmit = async (): Promise<void> => {
    setLoading(true);
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: formValues.url,
          uploadService: formValues.uploadService && formValues.uploadService !== 'none' ? formValues.uploadService : undefined,
          priority: formValues.priority || 'normal',
        }),
      });

      if (res.ok) {
        message.success('✅ 下载任务已创建');
        form.resetFields();
        setStep(0);
        setFormValues({ url: '' });
      } else {
        message.error('❌ 创建任务失败');
      }
    } catch (error) {
      console.error('Failed to create task:', error);
      message.error('❌ 请求失败');
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { title: '输入链接', description: '提供下载地址' },
    { title: '配置选项', description: '设置优先级和上传' },
    { title: '确认创建', description: '审核后创建任务' },
  ];

  const statusLabel = getPriorityLabel(formValues.priority);

  return (
    <div style={{ padding: '24px' }}>
      <Card
        title={
          <Space>
            <DownloadOutlined style={{ fontSize: '24px' }} />
            <span>创建下载任务</span>
          </Space>
        }
        style={{ marginBottom: '24px' }}
      >
        <Steps current={step} items={steps} style={{ marginBottom: '32px' }} />

        <Form
          form={form}
          layout="vertical"
          onValuesChange={(_, values) => setFormValues(values as FormValues)}
        >
          {/* 步骤 0: 输入链接 */}
          {step === 0 && (
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <Form.Item
                label="下载链接"
                name="url"
                rules={[
                  { required: true, message: '请输入下载链接' },
                  {
                    pattern: /^https?:\/\//,
                    message: '请输入有效的 HTTP(S) 链接',
                  },
                ]}
              >
                <Input
                  placeholder="https://example.com/file.zip"
                  prefix={<LinkOutlined />}
                  size="large"
                />
              </Form.Item>

              <Form.Item>
                <Button
                  type="primary"
                  size="large"
                  block
                  onClick={handleNext}
                  icon={<ArrowRightOutlined />}
                >
                  下一步
                </Button>
              </Form.Item>
            </Space>
          )}

          {/* 步骤 1: 配置选项 */}
          {step === 1 && (
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <Form.Item label="优先级" name="priority" initialValue="normal">
                <Select>
                  <Select.Option value="low">低</Select.Option>
                  <Select.Option value="normal">普通</Select.Option>
                  <Select.Option value="high">高</Select.Option>
                </Select>
              </Form.Item>

              <Form.Item label="完成后上传到" name="uploadService" initialValue="none">
                <Select>
                  <Select.Option value="none">不上传</Select.Option>
                  <Select.Option value="openlist">OpenList</Select.Option>
                  <Select.Option value="gofile">Gofile</Select.Option>
                </Select>
              </Form.Item>

              <Form.Item>
                <Space style={{ width: '100%' }} size="middle">
                  <Button size="large" style={{ flex: 1 }} onClick={handlePrev}>
                    上一步
                  </Button>
                  <Button
                    type="primary"
                    size="large"
                    style={{ flex: 1 }}
                    onClick={handleNext}
                    icon={<ArrowRightOutlined />}
                  >
                    下一步
                  </Button>
                </Space>
              </Form.Item>
            </Space>
          )}

          {/* 步骤 2: 确认 */}
          {step === 2 && (
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <Card
                type="inner"
                title="确认信息"
                style={{ backgroundColor: '#fafafa' }}
              >
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div>
                    <strong>下载链接: </strong>
                    <span>{formValues.url}</span>
                  </div>
                  <div>
                    <strong>优先级: </strong>
                    <span>{statusLabel}</span>
                  </div>
                  {formValues.uploadService && formValues.uploadService !== 'none' && (
                    <div>
                      <strong>上传服务: </strong>
                      <span>{formValues.uploadService}</span>
                    </div>
                  )}
                </Space>
              </Card>

              <Form.Item>
                <Space style={{ width: '100%' }} size="middle">
                  <Button size="large" style={{ flex: 1 }} onClick={handlePrev}>
                    上一步
                  </Button>
                  <Button
                    type="primary"
                    size="large"
                    style={{ flex: 1 }}
                    loading={loading}
                    onClick={handleSubmit}
                    icon={<DownloadOutlined />}
                  >
                    确认创建
                  </Button>
                </Space>
              </Form.Item>
            </Space>
          )}
        </Form>
      </Card>
    </div>
  );
}
