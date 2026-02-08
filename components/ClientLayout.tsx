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
      <div className="flex min-h-screen flex-col md:flex-row" id="app-layout">
        <NavbarWrapper />
        <main className="flex-1 mt-14 md:mt-0 md:ml-64 w-full transition-all duration-300" id="main-content">
          {children}
        </main>
      </div>
    </BackgroundProvider>
  );
}
