'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Form, Input, Button, Card, Typography, message } from 'antd';
import { UserOutlined, LockOutlined, RocketOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const onFinish = async (values: Record<string, string>) => {
    setLoading(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      const data = await res.json();
      if (res.ok) {
        message.success('登录成功');
        router.push('/');
      } else {
        message.error(data.error || '登录失败');
      }
    } catch {
      message.error('登录过程中发生错误');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#000] p-4 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-900/20 blur-[120px] rounded-full"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-900/20 blur-[120px] rounded-full"></div>

      <div className="w-full max-w-[420px] z-10">
        <div className="text-center mb-10">
          <div className="text-blue-500 mb-6 flex justify-center">
            <RocketOutlined style={{ fontSize: 64 }} />
          </div>
          <Title level={2} className="m-0 text-white font-bold tracking-tight">Web-DL-Manager</Title>
          <Text type="secondary" className="text-slate-500">欢迎回来，请登录您的账户</Text>
        </div>

        <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-md shadow-2xl rounded-3xl">
          <Form
            name="login"
            layout="vertical"
            onFinish={onFinish}
            autoComplete="off"
            requiredMark={false}
          >
            <Form.Item
              name="username"
              rules={[{ required: true, message: '请输入用户名' }]}
            >
              <Input 
                size="large" 
                prefix={<UserOutlined className="text-slate-500" />} 
                placeholder="用户名" 
                className="bg-slate-800/50 border-slate-700 h-12 rounded-xl text-white hover:border-blue-500 focus:border-blue-500"
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password 
                size="large" 
                prefix={<LockOutlined className="text-slate-500" />} 
                placeholder="密码" 
                className="bg-slate-800/50 border-slate-700 h-12 rounded-xl text-white hover:border-blue-500 focus:border-blue-500"
              />
            </Form.Item>

            <Form.Item className="mt-8 mb-0">
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                block
                size="large"
                style={{ 
                  height: 52, 
                  borderRadius: 12, 
                  fontSize: 16, 
                  fontWeight: 'bold',
                  background: 'linear-gradient(to right, #4facfe 0%, #00f2fe 100%)',
                  border: 'none'
                }}
              >
                立即登录
              </Button>
            </Form.Item>
          </Form>
        </Card>
        
        <div className="text-center mt-8">
          <Text className="text-slate-600 text-xs uppercase tracking-widest font-medium">Next.js Web-DL-Manager</Text>
        </div>
      </div>
    </div>
  );
}