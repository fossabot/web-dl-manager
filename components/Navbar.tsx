'use client';

import { Layout, Tooltip, Space } from 'antd';
import { Download, ListTodo, Activity, Settings, LogOut, Rocket } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';

const { Sider } = Layout;

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();

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

  return (
    <Sider
      width={64}
      theme="dark"
      className="fixed left-0 top-0 bottom-0 z-50 bg-black border-r border-slate-800"
      style={{ overflow: 'auto', height: '100vh' }}
    >
      <div className="flex flex-col h-full justify-between items-center py-6">
        <div className="flex flex-col items-center w-full">
          <div className="mb-10 text-blue-500">
            <Rocket size={32} />
          </div>
          
          <Space direction="vertical" size={24} align="center" className="w-full">
            {navItems.map((item) => (
              <Tooltip key={item.key} title={item.label} placement="right">
                <Link href={item.key}>
                  <div className={`p-3 rounded-xl transition-all cursor-pointer ${
                    pathname === item.key 
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
                      : 'text-slate-500 hover:text-white hover:bg-slate-900'
                  }`}>
                    {item.icon}
                  </div>
                </Link>
              </Tooltip>
            ))}
          </Space>
        </div>

        <Tooltip title="退出登录" placement="right">
          <div 
            onClick={handleLogout}
            className="p-3 rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition-all cursor-pointer"
          >
            <LogOut size={20} />
          </div>
        </Tooltip>
      </div>
    </Sider>
  );
}