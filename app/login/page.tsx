'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Lock, User, Key } from 'lucide-react';
import { App } from 'antd';

export default function LoginPage() {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const router = useRouter();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [resetUsername, setResetUsername] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const handleForgotPassword = async () => {
    if (!username) {
      message.error('请先输入用户名');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });

      const data = await res.json();
      if (res.ok) {
        message.success(data.message);
        setResetUsername(username);
        setShowForgotModal(true);
      } else {
        message.error(data.error || '请求失败');
      }
    } catch {
      message.error('发送请求时发生错误');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username: resetUsername,
          code: resetCode, 
          newPassword 
        }),
      });

      const data = await res.json();
      if (res.ok) {
        message.success(data.message);
        setShowForgotModal(false);
        setResetCode('');
        setNewPassword('');
      } else {
        message.error(data.error || '重置失败');
      }
    } catch {
      message.error('重置过程中发生错误');
    } finally {
      setResetLoading(false);
    }
  };

  const onFinish = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (res.ok) {
        message.success('登录成功');
        setTimeout(() => router.push('/'), 500);
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
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 relative overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute top-[-15%] left-[-10%] w-1/2 h-1/2 bg-blue-600/5 blur-[150px] rounded-full animate-pulse"></div>
      <div className="absolute bottom-[-15%] right-[-10%] w-1/2 h-1/2 bg-purple-600/5 blur-[150px] rounded-full animate-pulse" style={{ animationDelay: '2s' }}></div>
      <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] bg-indigo-600/5 blur-[120px] rounded-full"></div>

      {/* Grid Background Pattern */}
      <div className="absolute inset-0 z-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>

      <div className="w-full max-w-sm z-10">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="mb-6 inline-flex p-4 rounded-3xl bg-white border border-slate-200 shadow-sm">
            <div className="text-4xl">🚀</div>
          </div>

          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-2">
            Web-DL-Manager
          </h1>

          <div className="h-1 w-16 bg-gradient-to-r from-blue-500 to-purple-500 mx-auto mt-2 mb-4 rounded-full"></div>

          <p className="text-slate-500 text-base md:text-lg">开启极致下载体验</p>
        </div>

        {/* Login Card */}
        <div className="card-elevated p-8 md:p-10 backdrop-blur-xl shadow-xl border-slate-100">
          <form onSubmit={onFinish} className="space-y-4">
            {/* Username Field */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">用户名</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="请输入用户名"
                  required
                  className="input-base pl-10 h-12 border-slate-200 text-slate-900 placeholder:text-slate-400"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">密码</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入密码"
                  required
                  className="input-base pl-10 h-12 border-slate-200 text-slate-900 placeholder:text-slate-400"
                />
              </div>
            </div>

            {/* Forgot Password Link */}
            <div className="text-right pt-2">
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={loading}
                className="text-xs text-slate-500 hover:text-blue-600 transition-colors disabled:opacity-50"
              >
                忘记密码？
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-lg text-base font-bold bg-blue-600 hover:bg-blue-700 text-white transition-all disabled:opacity-50 mt-6 flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : null}
              登 录
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center mt-10">
          <div className="flex items-center justify-center gap-2 opacity-50">
            <span className="h-px w-8 bg-slate-600"></span>
            <p className="text-slate-500 text-xs uppercase tracking-widest font-bold">Secure Access Only</p>
            <span className="h-px w-8 bg-slate-600"></span>
          </div>
        </div>
      </div>

      {/* Reset Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card-elevated p-6 md:p-8 w-full max-w-sm">
            <h2 className="text-xl font-bold text-white mb-6">重置密码</h2>

            <form onSubmit={handleResetPassword} className="space-y-4">
              {/* Code Field */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">验证码 (32位)</label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value)}
                    placeholder="从控制台复制验证码"
                    required
                    className="input-base pl-10 h-10"
                  />
                </div>
              </div>

              {/* New Password Field */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">新密码</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="设置新密码"
                    required
                    className="input-base pl-10 h-10"
                  />
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotModal(false);
                    setResetCode('');
                    setNewPassword('');
                  }}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors font-medium"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white rounded-lg transition-all disabled:opacity-50 font-medium flex items-center justify-center gap-2"
                >
                  {resetLoading ? <Loader2 size={16} className="animate-spin" /> : null}
                  确认重置
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
