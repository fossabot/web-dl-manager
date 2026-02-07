/**
 * Background Manager
 * Manages custom background configuration for the application
 */

export interface BackgroundConfig {
  enabled: boolean;
  type: 'image' | 'video'; // 'image' or 'video'
  url: string; // External URL to the image or video
  opacity: number; // 0-1
  fit: 'cover' | 'contain' | 'fill'; // CSS background-size property
  position: string; // CSS background-position property
  blur?: number; // Optional blur effect (0-20px)
}

export const DEFAULT_BACKGROUND: BackgroundConfig = {
  enabled: false,
  type: 'image',
  url: '',
  opacity: 1,
  fit: 'cover',
  position: 'center',
  blur: 0,
};

/**
 * Apply background to an element
 */
export function applyBackground(element: HTMLElement, config: BackgroundConfig) {
  if (!config.enabled || !config.url) {
    element.style.backgroundImage = 'none';
    return;
  }

  const style: Partial<CSSStyleDeclaration> = {};

  if (config.type === 'image') {
    style.backgroundImage = `url("${config.url}")`;
    style.backgroundSize = config.fit;
    style.backgroundPosition = config.position;
    style.backgroundRepeat = 'no-repeat';
    style.backgroundAttachment = 'fixed';

    if (config.blur && config.blur > 0) {
      // For blur effect, we need a pseudo-element approach
      // This will be handled in CSS
      element.style.setProperty('--bg-blur', `${config.blur}px`);
    }

    style.opacity = String(config.opacity);
  } else if (config.type === 'video') {
    // For video background, we'll need to use a video element
    // This will be handled in a dedicated video background component
    element.style.setProperty('--bg-video-url', `url("${config.url}")`);
    element.style.setProperty('--bg-opacity', String(config.opacity));
  }

  Object.assign(element.style, style);
}

/**
 * Generate CSS for background
 */
export function generateBackgroundCSS(config: BackgroundConfig): string {
  if (!config.enabled || !config.url) {
    return '';
  }

  if (config.type === 'image') {
    return `
      background-image: url("${config.url}");
      background-size: ${config.fit};
      background-position: ${config.position};
      background-repeat: no-repeat;
      background-attachment: fixed;
      opacity: ${config.opacity};
      ${config.blur ? `filter: blur(${config.blur}px);` : ''}
    `;
  }

  return '';
}

/**
 * Validate background URL
 */
export function validateBackgroundURL(url: string, type: 'image' | 'video'): boolean {
  if (!url) return false;

  try {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol.toLowerCase();

    if (protocol !== 'http:' && protocol !== 'https:') {
      return false;
    }

    if (type === 'image') {
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.svg'];
      const pathname = urlObj.pathname.toLowerCase();
      return imageExtensions.some(ext => pathname.endsWith(ext));
    }

    if (type === 'video') {
      const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.m4v'];
      const pathname = urlObj.pathname.toLowerCase();
      return videoExtensions.some(ext => pathname.endsWith(ext));
    }

    return false;
  } catch {
    return false;
  }
}
