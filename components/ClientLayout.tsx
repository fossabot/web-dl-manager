'use client';

import { usePathname } from 'next/navigation';
import NavbarWrapper from './NavbarWrapper';
import { BackgroundProvider } from './BackgroundProvider';
import { useState, useEffect } from 'react';

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === 'undefined') return true;
    const saved = localStorage.getItem('sidebarOpen');
    return saved === null || saved === 'true';
  });

  // 监听localStorage变化
  useEffect(() => {
    const handleStorageChange = () => {
      const newValue = localStorage.getItem('sidebarOpen');
      setSidebarOpen(newValue === null || newValue === 'true');
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  if (isLoginPage) {
    return <main className="flex-1">{children}</main>;
  }

  return (
    <BackgroundProvider>
      <div className="flex min-h-screen flex-col md:flex-row" id="app-layout">
        <NavbarWrapper />
        <main 
          className={`flex-1 mt-14 md:mt-0 w-full transition-all duration-300 ${
            sidebarOpen ? 'md:ml-64' : 'md:ml-16'
          }`}
          id="main-content"
        >
          {children}
        </main>
      </div>
    </BackgroundProvider>
  );
}
