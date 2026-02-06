import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

const SECRET_KEY = process.env.JWT_SECRET || 'your-secret-key-at-least-32-chars-long';
const key = new TextEncoder().encode(SECRET_KEY);

export async function encrypt(payload: JWTPayload) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('2h')
    .sign(key);
}

export async function decrypt(input: string): Promise<JWTPayload> {
  const { payload } = await jwtVerify(input, key, {
    algorithms: ['HS256'],
  });
  return payload;
}
