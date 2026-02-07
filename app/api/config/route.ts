import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { dbConfig } from '@/lib/config';
import prisma from '@/lib/prisma';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const configs = await prisma.config.findMany();
  const configMap: Record<string, string | null> = {};
  configs.forEach((c) => {
    if (c.keyName) {
      configMap[c.keyName] = c.keyValue;
    }
  });

  return NextResponse.json(configMap);
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !user.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  for (const [key, value] of Object.entries(body)) {
    if (typeof value === 'string') {
      await dbConfig.setConfig(key, value);
    }
  }

  return NextResponse.json({ success: true });
}
