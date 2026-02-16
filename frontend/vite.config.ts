import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'url';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const publicHost = env.VITE_PUBLIC_HOST?.trim() || undefined;
  const isLocalPublicHost = publicHost === 'localhost' || publicHost === '127.0.0.1';
  const publicPort = Number(env.VITE_PUBLIC_PORT || env.VITE_PUBLIC_HMR_PORT || '');
  const devPort = Number(env.VITE_DEV_PORT || 5173);
  const usePolling = env.VITE_USE_POLLING === 'true';
  const pollingInterval = Number(env.VITE_POLL_INTERVAL || 300);
  const watchConfig = usePolling
    ? {
        usePolling: true,
        interval: Number.isFinite(pollingInterval) ? pollingInterval : 300,
      }
    : undefined;
  const hmrPort = Number.isFinite(publicPort)
    ? publicPort
    : (publicHost && !isLocalPublicHost ? 443 : devPort);
  const publicProtocol = env.VITE_PUBLIC_PROTOCOL || (publicHost && !isLocalPublicHost ? 'wss' : 'ws');

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
      // Allow access through tunnel/public domains in development
      allowedHosts: true,
      hmr: publicHost && !isLocalPublicHost
        ? {
            host: publicHost,
            protocol: publicProtocol,
            clientPort: hmrPort,
          }
        : undefined,
      watch: watchConfig,
      proxy: {
        '/api': {
          target: 'http://backend:3000',
          changeOrigin: true,
        },
        '/uploads': {
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
