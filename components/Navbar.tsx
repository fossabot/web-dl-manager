'use client';

import { SideBar, Logo, ActionIcon, Tooltip } from '@lobehub/ui';
import { Download, ListTodo, Activity, Settings, LogOut } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    router.push('/login');
  };

  const navItems = [
    { name: '下载器', path: '/', icon: <Download size={20} /> },
    { name: '任务列表', path: '/tasks', icon: <ListTodo size={20} /> },
    { name: '系统状态', path: '/status', icon: <Activity size={20} /> },
    { name: '系统设置', path: '/settings', icon: <Settings size={20} /> },
  ];

  return (
    <div className="fixed left-0 top-0 bottom-0 z-50">
      <SideBar
        header={
          <div className="flex items-center justify-center py-4">
            <Logo size={32} />
          </div>
        }
        footer={
          <div className="flex flex-col items-center pb-4 space-y-4">
            <Tooltip title="退出登录">
              <ActionIcon
                icon={<LogOut size={20} />}
                onClick={handleLogout}
                size="large"
              />
            </Tooltip>
          </div>
        }
      >
        <div className="flex flex-col items-center py-4 space-y-6">
          {navItems.map((item) => (
            <Tooltip key={item.name} title={item.name} placement="right">
              <Link href={item.path}>
                <ActionIcon
                  active={pathname === item.path}
                  icon={item.icon}
                  size="large"
                />
              </Link>
            </Tooltip>
          ))}
        </div>
      </SideBar>
    </div>
  );
}