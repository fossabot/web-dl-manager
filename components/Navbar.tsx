'use client';

import { useState, useLayoutEffect } from 'react';
import { Download, ListTodo, Activity, Settings, LogOut, Rocket, Menu, X } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    // 初始化时从本地存储读取
    if (typeof window === 'undefined') return true;
    const saved = localStorage.getItem('sidebarOpen');
    return saved === null || saved === 'true';
  });

  useLayoutEffect(() => {
    // 保存侧边栏状态到本地存储
    localStorage.setItem('sidebarOpen', String(sidebarOpen));
    // 触发存储事件使 ClientLayout 能同步状态
    window.dispatchEvent(new Event('storage'));
  }, [sidebarOpen]);

  const handleLogout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    router.push('/login');
  };

  const navItems = [
    { key: '/', label: '下载器', icon: <Download size={20} /> },
    { key: '/tasks', label: '任务列表', icon: <ListTodo size={20} /> },
    { key: '/status', label: '系统状态', icon: <Activity size={20} /> },
    { key: '/settings', label: '系统设置', icon: <Settings size={20} /> },
  ];

  const isActive = (path: string) => pathname === path;

  return (
    <>
      {/* 侧边栏 - 全平台统一 */}
      <nav 
        className={`fixed left-0 top-0 bottom-0 z-50 flex flex-col items-center justify-between bg-white border-r border-slate-200 py-6 transition-all duration-300 overflow-hidden ${
          sidebarOpen ? 'w-64' : 'w-16'
        }`}
      >
        {/* 顶部菜单按钮和Logo */}
        <div className="flex flex-col items-center w-full gap-6">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-3 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
            title={sidebarOpen ? '收起菜单' : '展开菜单'}
          >
            {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>

          <div className="text-blue-600 hover:text-blue-500 transition-colors">
            <Rocket size={32} />
          </div>

          <div className="flex flex-col items-center w-full gap-2 px-2">
            {navItems.map((item) => (
              <Link key={item.key} href={item.key} className="w-full" title={item.label}>
                <div
                  className={`py-3 rounded-xl transition-all duration-200 cursor-pointer flex items-center gap-3 ${
                    sidebarOpen ? 'justify-start px-4' : 'justify-center'
                  } ${
                    isActive(item.key)
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  {item.icon}
                  {sidebarOpen && <span className="whitespace-nowrap text-sm font-medium">{item.label}</span>}
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* 退出按钮 */}
        <div className="w-full px-2">
          <button
            onClick={handleLogout}
            className={`p-3 rounded-xl text-slate-500 hover:text-red-500 hover:bg-red-50 transition-all cursor-pointer flex items-center gap-3 w-full ${
              sidebarOpen ? 'justify-start px-4' : 'justify-center'
            }`}
            title="退出登录"
          >
            <LogOut size={20} />
            {sidebarOpen && <span className="whitespace-nowrap text-sm font-medium">退出登录</span>}
          </button>
        </div>
      </nav>
    </>
  );
}
