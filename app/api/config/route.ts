import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { dbConfig } from '@/lib/config';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: '未认证', message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const configs = await prisma.config.findMany();
    const configMap: Record<string, string | null> = {};
    configs.forEach((c) => {
      if (c.keyName) {
        configMap[c.keyName] = c.keyValue;
      }
    });

    return NextResponse.json({
      success: true,
      data: configMap
    });
  } catch (error) {
    console.error('Config GET error:', error);
    return NextResponse.json(
      { error: '获取配置失败', message: 'Failed to get config' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || !user.isAdmin) {
      return NextResponse.json(
        { error: '权限不足', message: 'Insufficient permissions' },
        { status: 401 }
      );
    }

    const body = await request.json();
    for (const [key, value] of Object.entries(body)) {
      if (typeof value === 'string') {
        await dbConfig.setConfig(key, value);
      }
    }

    return NextResponse.json({
      success: true,
      message: '配置已保存'
    });
  } catch (error) {
    console.error('Config POST error:', error);
    return NextResponse.json(
      { error: '保存配置失败', message: 'Failed to save config' },
      { status: 500 }
    );
  }
}
