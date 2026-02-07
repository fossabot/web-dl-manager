import Redis from 'ioredis';
import { Redis as UpstashRedis } from '@upstash/redis';
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
let isUpstash = false;

export async function initRedis() {
  const upstashUrl = await dbConfig.getConfig('UPSTASH_REDIS_REST_URL') || process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = await dbConfig.getConfig('UPSTASH_REDIS_REST_TOKEN') || process.env.UPSTASH_REDIS_REST_TOKEN;
  const redisUrl = await dbConfig.getConfig('REDIS_URL') || process.env.REDIS_URL;

  // Cleanup existing client if any
  if (redis && 'quit' in redis && typeof redis.quit === 'function') {
    try {
      await redis.quit();
    } catch (e) {
      console.error('Error quitting redis client:', e);
    }
  }

  if (upstashUrl && upstashToken) {
    try {
      redis = new UpstashRedis({
        url: upstashUrl,
        token: upstashToken,
      }) as unknown as RedisClient;
      isUpstash = true;
      await redis.ping();
      console.log('Connected to Upstash Redis via HTTP');
      return redis;
    } catch (error) {
      console.error('Failed to connect to Upstash Redis:', error);
    }
  }

  if (redisUrl) {
    try {
      const client = new Redis(redisUrl);
      await client.ping();
      redis = client as unknown as RedisClient;
      isUpstash = false;
      console.log('Connected to Redis via ioredis');
      return redis;
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
    }
  }

  redis = null;
  return null;
}

export function getRedis() {
  return redis;
}

export function checkIsUpstash() {
  return isUpstash;
}
