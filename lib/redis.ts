import Redis from 'ioredis';
import { dbConfig } from './config';

let redis: Redis | null = null;

export async function initRedis() {
  const redisUrl = await dbConfig.getConfig('REDIS_URL') || process.env.REDIS_URL;

  if (!redisUrl) {
    if (redis) {
      await redis.quit();
      redis = null;
    }
    return null;
  }

  try {
    if (redis) {
      await redis.quit();
    }
    redis = new Redis(redisUrl);
    await redis.ping();
    return redis;
  } catch (error) {
    console.error('Failed to connect to Redis:', error);
    redis = null;
    return null;
  }
}

export function getRedis() {
  return redis;
}
