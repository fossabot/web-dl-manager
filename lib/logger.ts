const isHfSpace = process.env.SPACE_ID !== undefined;

/**
 * 还原 Python 版本的日志机制：
 * 如果检测到 SPACE_ID (Hugging Face Spaces)，则只输出 CRITICAL/ERROR 级别的日志。
 */
export const logger = {
  debug: (...args: any[]) => {
    if (!isHfSpace && process.env.DEBUG_MODE === 'true') {
      console.debug('[DEBUG]', ...args);
    }
  },
  info: (...args: any[]) => {
    if (!isHfSpace) {
      console.info('[INFO]', ...args);
    }
  },
  warn: (...args: any[]) => {
    if (!isHfSpace) {
      console.warn('[WARN]', ...args);
    }
  },
  error: (...args: any[]) => {
    // ERROR 级别始终输出
    console.error('[ERROR]', ...args);
  },
  critical: (...args: any[]) => {
    // CRITICAL 级别始终输出
    console.error('[CRITICAL]', ...args);
  }
};
