import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getRedis } from '@/lib/redis';
import { hashPassword } from '@/lib/auth';
import { getResetCode, deleteResetCode } from '@/lib/reset-code-cache';

export async function POST(request: Request) {
  try {
    const { username, code, newPassword } = await request.json();

    if (!username || !code || !newPassword) {
      return NextResponse.json({ error: '请填写所有必填字段' }, { status: 400 });
    }

    // 1. 验证验证码 - 优先使用 Redis，备选内存缓存
    let storedCode: string | null = null;
    const redis = getRedis();
    
    if (redis) {
      storedCode = await redis.get(`reset_code:${username}`);
    } else {
      // Redis 不可用，使用内存缓存
      storedCode = getResetCode(username);
    }

    if (!storedCode || storedCode !== code) {
      return NextResponse.json({ error: '验证码无效或已过期' }, { status: 400 });
    }

    // 2. 更新密码
    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    const hashedPassword = hashPassword(newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: { hashedPassword },
    });

    // 3. 删除验证码
    if (redis) {
      await redis.del(`reset_code:${username}`);
    } else {
      deleteResetCode(username);
    }

    return NextResponse.json({ success: true, message: '密码已重置，请使用新密码登录' });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json({ error: '内部服务器错误' }, { status: 500 });
  }
}
