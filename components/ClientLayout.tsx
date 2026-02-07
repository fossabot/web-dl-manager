'use client';

import { usePathname } from 'next/navigation';
import NavbarWrapper from './NavbarWrapper';

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
    <div className="flex min-h-screen">
      <NavbarWrapper />
      <main className="flex-1 ml-[64px]">{children}</main>
    </div>
  );
}
