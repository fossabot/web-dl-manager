import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/frontend'),
    },
  },
  server: {
    // Configure proxy to forward backend API requests to the Node.js server
    // This assumes the backend server will be running on a different port (e.g., 3000)
    // For a full-stack approach where Vite serves the backend, more advanced plugins might be needed.
    proxy: {
      '/api': {
        target: 'http://localhost:3000', // Assuming backend runs on port 3000
        changeOrigin: true,
      },
      // Add other proxy rules if necessary, e.g., for websockets
    },
    open: true, // Automatically open the browser when dev server starts
  },
  build: {
    outDir: 'dist/frontend', // Output directory for frontend build
    emptyOutDir: true, // Clean the output directory before building
  },
});
