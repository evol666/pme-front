import path from 'path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig(({ command }) => {
  const isBuild = command === 'build';
  const basename = isBuild ? '/pme/' : '/';

  return {
    base: basename,
    plugins: [react(), tailwindcss()],
    resolve: {
      preserveSymlinks: true,
      alias: {
        '@': path.resolve(__dirname, './src'),
        buffer: 'buffer',
      },
    },
    define: {
      global: {},
    },
    optimizeDeps: {
      esbuildOptions: {
        define: {
          global: 'globalThis',
        },
      },
    },
    server: {
      port: 3000,
      proxy: {
        '/pme': {
          target: process.env.VITE_PROXY_BACKEND || 'http://localhost:8080',
          changeOrigin: true,
          xfwd: true,
          rewrite: path => path.replace(/^\/pme/, ''),
        },
        '/api': {
          target: process.env.VITE_PROXY_BACKEND || 'http://localhost:8080',
          changeOrigin: true,
          xfwd: true,
        },
        '/services': {
          target: process.env.VITE_PROXY_BACKEND || 'http://localhost:8080',
          changeOrigin: true,
          xfwd: true,
        },
        '/oauth2': {
          target: process.env.VITE_PROXY_BACKEND || 'http://localhost:8080',
          changeOrigin: true,
          xfwd: true,
        },
        '/login/oauth2/': {
          target: process.env.VITE_PROXY_BACKEND || 'http://localhost:8080',
          changeOrigin: true,
          xfwd: true,
        },
        '/logout': {
          target: process.env.VITE_PROXY_BACKEND || 'http://localhost:8080',
          changeOrigin: true,
          xfwd: true,
        },
      },
    },
  };
});
