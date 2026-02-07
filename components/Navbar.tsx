'use client';

import { useState } from 'react';
import { Download, ListTodo, Activity, Settings, LogOut, Rocket, Menu, X } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
      {/* 桌面导航栏 */}
      <nav className="hidden md:flex fixed left-0 top-0 bottom-0 z-50 w-16 flex-col items-center justify-between bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 border-r border-slate-800 py-6">
        <div className="flex flex-col items-center w-full gap-6">
          <div className="text-blue-600 hover:text-blue-500 transition-colors">
            <Rocket size={32} />
          </div>

          <div className="flex flex-col items-center w-full gap-6">
            {navItems.map((item) => (
              <Link key={item.key} href={item.key} title={item.label}>
                <div
                  className={`p-3 rounded-xl transition-all duration-200 cursor-pointer ${
                    isActive(item.key)
                      ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-600/30'
                      : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
                  }`}
                >
                  {item.icon}
                </div>
              </Link>
            ))}
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="p-3 rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition-all cursor-pointer"
          title="退出登录"
        >
          <LogOut size={20} />
        </button>
      </nav>

      {/* 移动端顶部导航栏 */}
      <nav className="md:hidden fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-slate-950 to-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Rocket size={24} className="text-blue-600" />
          <span className="text-white font-semibold">Web DL Manager</span>
        </div>

        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800/50 transition-colors"
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </nav>

      {/* 移动端菜单下拉框 */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed top-14 left-0 right-0 z-40 bg-slate-900 border-b border-slate-800 shadow-xl">
          <div className="divide-y divide-slate-800">
            {navItems.map((item) => (
              <Link key={item.key} href={item.key} onClick={() => setMobileMenuOpen(false)}>
                <div
                  className={`px-4 py-3 flex items-center gap-3 transition-colors ${
                    isActive(item.key)
                      ? 'bg-blue-600/20 text-blue-400'
                      : 'text-slate-300 hover:bg-slate-800/50'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </div>
              </Link>
            ))}
            <button
              onClick={() => {
                handleLogout();
                setMobileMenuOpen(false);
              }}
              className="w-full px-4 py-3 flex items-center gap-3 text-red-400 hover:bg-red-400/10 transition-colors"
            >
              <LogOut size={20} />
              <span>退出登录</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}