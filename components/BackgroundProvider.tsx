'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { BackgroundConfig, DEFAULT_BACKGROUND } from '@/lib/background-manager';

interface BackgroundContextType {
  config: BackgroundConfig;
  updateBackground: (config: BackgroundConfig) => void;
  loading: boolean;
}

const BackgroundContext = createContext<BackgroundContextType | undefined>(undefined);

export function BackgroundProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<BackgroundConfig>(DEFAULT_BACKGROUND);
  const [loading, setLoading] = useState(true);

  // Load background config from database on mount
  useEffect(() => {
    const loadBackgroundConfig = async () => {
      try {
        // Fetch from config API which uses database
        const res = await fetch('/api/config?keys=WDM_BG_CONFIG');
        if (res.ok) {
          const data = await res.json();
          if (data.WDM_BG_CONFIG) {
            try {
              const bgConfig = JSON.parse(data.WDM_BG_CONFIG) as BackgroundConfig;
              setConfig(bgConfig);
              applyBackgroundToDOM(bgConfig);
            } catch (error) {
              console.error('Failed to parse background config:', error);
              setConfig(DEFAULT_BACKGROUND);
            }
          } else {
            setConfig(DEFAULT_BACKGROUND);
          }
        }
      } catch (error) {
        console.error('Failed to load background config:', error);
        setConfig(DEFAULT_BACKGROUND);
      } finally {
        setLoading(false);
      }
    };

    loadBackgroundConfig();
  }, []);

  // Apply background to DOM when config changes
  const applyBackgroundToDOM = (bgConfig: BackgroundConfig) => {
    const htmlElement = document.documentElement;

    if (!bgConfig.enabled || !bgConfig.url) {
      htmlElement.style.backgroundImage = 'none';
      htmlElement.style.opacity = '1';
      htmlElement.style.filter = 'none';
      return;
    }

    if (bgConfig.type === 'image') {
      htmlElement.style.backgroundImage = `url("${bgConfig.url}")`;
      htmlElement.style.backgroundSize = bgConfig.fit || 'cover';
      htmlElement.style.backgroundPosition = bgConfig.position || 'center';
      htmlElement.style.backgroundRepeat = 'no-repeat';
      htmlElement.style.backgroundAttachment = 'fixed';
      htmlElement.style.opacity = String(bgConfig.opacity ?? 1);

      if (bgConfig.blur && bgConfig.blur > 0) {
        htmlElement.style.filter = `blur(${bgConfig.blur}px)`;
      } else {
        htmlElement.style.filter = 'none';
      }
    } else if (bgConfig.type === 'video') {
      console.warn('Video background support is coming soon');
    }
  };

  const updateBackground = (newConfig: BackgroundConfig) => {
    setConfig(newConfig);
    applyBackgroundToDOM(newConfig);
  };

  return (
    <BackgroundContext.Provider value={{ config, updateBackground, loading }}>
      {children}
    </BackgroundContext.Provider>
  );
}

export function useBackground() {
  const context = useContext(BackgroundContext);
  if (context === undefined) {
    throw new Error('useBackground must be used within BackgroundProvider');
  }
  return context;
}
