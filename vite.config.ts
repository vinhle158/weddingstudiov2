import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
          demo: path.resolve(__dirname, 'demo.html'),
        },
        output: {
          manualChunks(id) {
            if (id.includes('/src/components/mobile/')) return 'app-mobile';
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('/recharts/') || id.includes('/d3-')) return 'vendor-charts';
            if (id.includes('/lucide-react/')) return 'vendor-icons';
            if (id.includes('/gsap/') || id.includes('/motion/') || id.includes('/framer-motion/')) return 'vendor-animation';
            if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/scheduler/')) return 'vendor-react';
            return 'vendor';
          },
        },
      },
    },
    server: {
      // Có thể tắt HMR bằng biến DISABLE_HMR khi môi trường chỉnh sửa không hỗ trợ theo dõi file ổn định.
      // Khi HMR bị tắt, không theo dõi thay đổi file để tránh tải lại giao diện ngoài ý muốn.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Tắt file watcher cùng HMR để giảm CPU trong môi trường tự động hóa.
      watch: process.env.DISABLE_HMR === 'true' ? null : {
        ignored: ['**/db.json', '**/backups/**']
      },
    },
  };
});
