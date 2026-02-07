// Shared in-memory cache for password reset codes
// Used when Redis is not available

interface CacheEntry {
  code: string;
  expires: number;
}

const resetCodeCache = new Map<string, CacheEntry>();

// Cleanup expired codes periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of resetCodeCache.entries()) {
    if (value.expires < now) {
      resetCodeCache.delete(key);
    }
  }
}, 60000); // Every minute

export function setResetCode(username: string, code: string, expiresIn: number = 600000): void {
  resetCodeCache.set(`reset_code:${username}`, {
    code,
    expires: Date.now() + expiresIn
  });
}

export function getResetCode(username: string): string | null {
  const entry = resetCodeCache.get(`reset_code:${username}`);
  if (!entry) return null;
  if (entry.expires < Date.now()) {
    resetCodeCache.delete(`reset_code:${username}`);
    return null;
  }
  return entry.code;
}

export function deleteResetCode(username: string): void {
  resetCodeCache.delete(`reset_code:${username}`);
}

export function clearAllResetCodes(): void {
  resetCodeCache.clear();
}
