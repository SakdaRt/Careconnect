import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'url';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const publicHost = env.VITE_PUBLIC_HOST;
  const publicPort = Number(env.VITE_PUBLIC_PORT || env.VITE_PUBLIC_HMR_PORT || '');
  const devPort = Number(env.VITE_DEV_PORT || 5173);
  const hmrPort = Number.isFinite(publicPort) ? publicPort : devPort;
  const publicProtocol = env.VITE_PUBLIC_PROTOCOL || 'ws';

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
      dedupe: ['react', 'react-dom'],
    },
    test: {
      environment: 'jsdom',
      setupFiles: [],
      globals: true,
    },
    server: {
      host: true,
      port: devPort,
      strictPort: true,
      allowedHosts: publicHost ? [publicHost] : undefined,
      hmr: publicHost
        ? {
            host: publicHost,
            protocol: publicProtocol,
            clientPort: hmrPort,
          }
        : undefined,
      watch: {
        usePolling: true,
      },
      proxy: {
        '/api': {
          target: 'http://backend:3000',
          changeOrigin: true,
        },
        '/socket.io': {
          target: 'http://backend:3000',
          changeOrigin: true,
          ws: true,
        },
      },
    },
    preview: {
      host: true,
      port: devPort,
      strictPort: true,
    },
  };
});
