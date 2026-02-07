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

      <div className="min-h-screen flex items-center justify-center bg-[#050505] p-6 relative overflow-hidden">

        {/* Background Decorative Elements */}

        <div className="absolute top-[-15%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 blur-[150px] rounded-full animate-pulse"></div>

        <div className="absolute bottom-[-15%] right-[-10%] w-[50%] h-[50%] bg-purple-600/10 blur-[150px] rounded-full animate-pulse" style={{ animationDelay: '2s' }}></div>

        <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] bg-indigo-600/5 blur-[120px] rounded-full"></div>

        

        {/* Grid Background Pattern */}

        <div className="absolute inset-0 z-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>

  

        <div className="w-full max-w-[440px] z-10">

          <div className="text-center mb-12">

            <div className="mb-6 inline-flex p-4 rounded-3xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-white/5 shadow-inner">

              <RocketOutlined style={{ fontSize: 56, color: '#3b82f6' }} className="drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]" />

            </div>

            <Title level={1} className="m-0 !text-white font-extrabold tracking-tight !text-4xl">

              Web-DL-Manager

            </Title>

            <div className="h-1 w-20 bg-gradient-to-r from-blue-500 to-purple-500 mx-auto mt-4 mb-4 rounded-full"></div>

            <Text className="text-slate-400 text-lg">开启极致下载体验</Text>

          </div>

  

          <Card 

            className="bg-slate-900/40 border-white/10 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-[2rem] overflow-hidden"

            styles={{ body: { padding: '40px' } }}

          >

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

                  prefix={<UserOutlined className="text-slate-400" />} 

                  placeholder="用户名" 

                  className="bg-white/5 border-white/10 h-14 rounded-2xl text-white placeholder:text-slate-500 hover:border-blue-500/50 focus:border-blue-500 transition-all"

                />

              </Form.Item>

  

              <Form.Item

                name="password"

                rules={[{ required: true, message: '请输入密码' }]}

                className="mt-6"

              >

                <Input.Password 

                  size="large" 

                  prefix={<LockOutlined className="text-slate-400" />} 

                  placeholder="密码" 

                  className="bg-white/5 border-white/10 h-14 rounded-2xl text-white placeholder:text-slate-500 hover:border-blue-500/50 focus:border-blue-500 transition-all"

                />

              </Form.Item>

  

              <Form.Item className="mt-10 mb-0">

                <Button

                  type="primary"

                  htmlType="submit"

                  loading={loading}

                  block

                  size="large"

                  className="h-14 rounded-2xl text-lg font-bold shadow-lg shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all"

                  style={{ 

                    background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',

                    border: 'none'

                  }}

                >

                  登 录

                </Button>

              </Form.Item>

            </Form>

          </Card>

          

          <div className="text-center mt-10">

            <div className="flex items-center justify-center gap-2 opacity-50">

              <span className="h-[1px] w-8 bg-slate-600"></span>

              <Text className="text-slate-500 text-[10px] uppercase tracking-[0.3em] font-bold">Secure Access Only</Text>

              <span className="h-[1px] w-8 bg-slate-600"></span>

            </div>

          </div>

        </div>

      </div>

    );

  }

  