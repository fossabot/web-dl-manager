'use client';

import { usePathname } from 'next/navigation';
import Navbar from './Navbar';

export default function NavbarWrapper() {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';

  if (isLoginPage) return null;

  return <Navbar />;
}
