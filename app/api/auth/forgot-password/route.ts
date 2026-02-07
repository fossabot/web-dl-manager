import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const { username } = await request.json();

    if (!username) {
      return NextResponse.json({ error: '请输入用户名' }, { status: 400 });
    }

    // 生成32位复杂验证码
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+';
    let code = '';
    const randomBytes = crypto.randomBytes(32);
    for (let i = 0; i < 32; i++) {
      code += charset[randomBytes[i] % charset.length];
    }

    // 控制台输出
    console.log('\n==================================================');
    console.log('密码重置请求');
    console.log(`用户: ${username}`);
    console.log(`验证码: ${code}`);
    console.log('==================================================\n');

    return NextResponse.json({ 
      success: true, 
      message: '验证码已发送至控制台（请在服务端日志中查看）' 
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json({ error: '内部服务器错误' }, { status: 500 });
  }
}