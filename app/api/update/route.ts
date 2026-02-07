import { NextResponse } from 'next/server';
import { checkForUpdates, runUpdate, restartApplication } from '@/lib/updater';

export async function GET() {
  const info = await checkForUpdates();
  return NextResponse.json(info);
}

export async function POST() {
  const result = await runUpdate();
  if (result.status === 'success') {
      // Restart in background
      setTimeout(() => {
          restartApplication();
      }, 1000);
  }
  return NextResponse.json(result);
}
