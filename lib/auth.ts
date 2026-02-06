import crypto from 'crypto';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import prisma from './prisma';

const SECRET_KEY = process.env.JWT_SECRET || 'your-secret-key-at-least-32-chars-long';
const key = new TextEncoder().encode(SECRET_KEY);

const SESSION_TIMEOUT = 1800; // 30 minutes

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.createHash('sha256').update(salt + password).digest('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, hash] = storedHash.split(':');
  const computedHash = crypto.createHash('sha256').update(salt + password).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(computedHash), Buffer.from(hash));
}

export async function encrypt(payload: any) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('2h')
    .sign(key);
}

export async function decrypt(input: string): Promise<any> {
  const { payload } = await jwtVerify(input, key, {
    algorithms: ['HS256'],
  });
  return payload;
}

export async function login(username: string) {
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) return null;

  const expires = new Date(Date.now() + SESSION_TIMEOUT * 1000);
  const session = await encrypt({ userId: user.id, username: user.username, isAdmin: user.isAdmin, expires });

  (await cookies()).set('session', session, { expires, httpOnly: true });
  return user;
}

export async function logout() {
  (await cookies()).set('session', '', { expires: new Date(0) });
}

export async function getSession() {
  const session = (await cookies()).get('session')?.value;
  if (!session) return null;
  try {
    return await decrypt(session);
  } catch (e) {
    return null;
  }
}

export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;
  
  // Check expiration manually if needed, though JWT handles it
  if (new Date(session.expires) < new Date()) {
    return null;
  }

  return await prisma.user.findUnique({ where: { id: session.userId } });
}
