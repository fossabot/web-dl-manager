import Redis from 'ioredis';
import { dbConfig } from './config';

// Define a common interface for the methods we use
export interface RedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ...args: (string | number)[]): Promise<'OK' | string | null>;
  del(key: string): Promise<number>;
  ping(): Promise<string | null>;
  quit?(): Promise<'OK' | string>;
}

let redis: RedisClient | null = null;

/**
 * Initialize Redis client from DATABASE_URL or legacy REDIS_URL config.
 * 
 * Supports:
 * - redis://[password@]host:port[/db]
 * - rediss://[password@]host:port[/db] (TLS)
 * 
 * Falls back to legacy REDIS_URL config key for backwards compatibility.
 */
export async function initRedis() {
  // Cleanup existing client if any
  if (redis && 'quit' in redis && typeof redis.quit === 'function') {
    try {
      await redis.quit();
    } catch (e) {
      console.error('Error quitting redis client:', e);
    }
  }

  // Try DATABASE_URL first (preferred method)
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl?.startsWith('redis://') || databaseUrl?.startsWith('rediss://')) {
    try {
      const client = new Redis(databaseUrl);
      await client.ping();
      redis = client as unknown as RedisClient;
      console.log('Connected to Redis via DATABASE_URL');
      return redis;
    } catch (error) {
      console.error('Failed to connect to Redis via DATABASE_URL:', error);
    }
  }

  // Fall back to legacy REDIS_URL config (for backwards compatibility)
  const legacyRedisUrl = await dbConfig.getConfig('REDIS_URL') || process.env.REDIS_URL;
  if (legacyRedisUrl) {
    try {
      const client = new Redis(legacyRedisUrl);
      await client.ping();
      redis = client as unknown as RedisClient;
      console.log('Connected to Redis via legacy REDIS_URL config');
      return redis;
    } catch (error) {
      console.error('Failed to connect to Redis via REDIS_URL:', error);
    }
  }

  redis = null;
  return null;
}

export function getRedis() {
  return redis;
}
