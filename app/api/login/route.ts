import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyPassword, login } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: '用户名和密码是必需的', message: 'Username and password are required' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user || !verifyPassword(password, user.hashedPassword)) {
      return NextResponse.json(
        { error: '用户名或密码错误', message: 'Invalid username or password' },
        { status: 401 }
      );
    }

    await login(user.username);

    return NextResponse.json({
      success: true,
      message: '登录成功',
      user: {
        id: user.id,
        username: user.username,
        isAdmin: user.isAdmin
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: '服务器错误', message: 'Internal server error' },
      { status: 500 }
    );
  }
}
