'use client';

import { usePathname } from 'next/navigation';
import NavbarWrapper from './NavbarWrapper';
import { BackgroundProvider } from './BackgroundProvider';

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';

  if (isLoginPage) {
    return <main className="flex-1">{children}</main>;
  }

  return (
    <BackgroundProvider>
      <div className="flex min-h-screen flex-col md:flex-row">
        <NavbarWrapper />
        {/* 移动端：顶部导航栏空间 + 菜单下拉空间，桌面端：侧边栏空间 */}
        <main className="flex-1 mt-14 md:mt-0 md:ml-16 w-full">
          {children}
        </main>
      </div>
    </BackgroundProvider>
  );
}
