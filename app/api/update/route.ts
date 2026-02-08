import { NextResponse } from 'next/server';
import { checkForUpdates } from '@/lib/updater';

export async function GET() {
  try {
    const info = await checkForUpdates();
    return NextResponse.json({
      success: true,
      ...info
    });
  } catch (error) {
    console.error('Check updates error:', error);
    return NextResponse.json(
      { error: '检查更新失败', message: 'Failed to check updates' },
      { status: 500 }
    );
  }
}

export async function POST() {
  // Next.js version: only display latest version, cannot update
  return NextResponse.json(
    {
      error: '更新功能已禁用',
      message: 'Update functionality is disabled in Next.js version. Please check the latest release on GitHub.',
      info: 'https://github.com/Jyf0214/web-dl-manager/releases'
    },
    { status: 403 }
  );
}
