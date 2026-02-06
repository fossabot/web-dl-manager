import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyPassword, login } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user || !verifyPassword(password, user.hashedPassword)) {
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
    }

    await login(user.username);

    return NextResponse.json({ success: true, user: { id: user.id, username: user.username, isAdmin: user.isAdmin } });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
