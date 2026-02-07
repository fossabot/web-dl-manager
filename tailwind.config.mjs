/** @type {import('tailwindcss').Config} */
import containerQueries from '@tailwindcss/container-queries';

export default {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './node_modules/@lobehub/ui/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        slate: {
          950: '#0a0e27',
          925: '#0d1227',
        },
      },
      spacing: {
        'safe-l': 'env(safe-area-inset-left)',
        'safe-r': 'env(safe-area-inset-right)',
        'safe-t': 'env(safe-area-inset-top)',
        'safe-b': 'env(safe-area-inset-bottom)',
      },
      fontSize: {
        'mobile-sm': ['12px', { lineHeight: '16px' }],
        'mobile-base': ['14px', { lineHeight: '20px' }],
        'mobile-lg': ['16px', { lineHeight: '24px' }],
      },
      screens: {
        'xs': '320px',
        'sm': '375px',
        'md': '640px',
        'lg': '1024px',
        'xl': '1280px',
        '2xl': '1536px',
      },
    },
  },
  plugins: [
    containerQueries,
  ],
};
