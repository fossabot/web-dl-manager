import prisma from './prisma';

class ConfigManager {
  private cache: Map<string, string> = new Map();

  async getConfig(key: string, defaultValue: string | null = null): Promise<string | null> {
    // 1. Try Cache
    if (this.cache.has(key)) {
      return this.cache.get(key) || null;
    }

    // 2. Try DB
    try {
      const item = await prisma.config.findUnique({
        where: { keyName: key },
      });
      if (item && item.keyValue !== null) {
        this.cache.set(key, item.keyValue);
        return item.keyValue;
      }
    } catch (error) {
      console.error(`Error getting config '${key}' from DB:`, error);
    }

    // 3. Strict Mode Check (if DATABASE_URL is set as env, maybe we don't fallback to other envs?)
    // In the original code: if os.getenv("DATABASE_URL"): return default
    if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('sqlite')) {
        return defaultValue;
    }

    // 4. Fallback to Env
    const envVal = process.env[key];
    if (envVal !== undefined) {
      this.cache.set(key, envVal);
      return envVal;
    }

    return defaultValue;
  }

  async setConfig(key: string, value: string): Promise<void> {
    try {
      await prisma.config.upsert({
        where: { keyName: key },
        update: { keyValue: value },
        create: { keyName: key, keyValue: value },
      });
      this.cache.set(key, value);
    } catch (error) {
      console.error(`Error setting config '${key}':`, error);
    }
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export const dbConfig = new ConfigManager();
