import { NextResponse } from 'next/server';
import { logout } from '@/lib/auth';

export async function POST() {
  try {
    await logout();
    return NextResponse.json({
      success: true,
      message: '已登出'
    });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: '登出失败', message: 'Logout failed' },
      { status: 500 }
    );
  }
}
