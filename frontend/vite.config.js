import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import path from 'path';

export default defineConfig(({ command }) => ({
  plugins: [
    react({
      jsxImportSource: '@emotion/react', // ถ้าใช้ Emotion
      babel: {
        plugins: ['@emotion/babel-plugin'], // ถ้าใช้ Emotion
      },
    }),
    // วิเคราะห์ bundle size เฉพาะเมื่อสั่ง ANALYZE=1 npm run build (เดิมเปิดเบราว์เซอร์ทุกครั้งที่ build)
    ...(process.env.ANALYZE ? [visualizer({
      open: true,
      filename: 'bundle-analysis.html',
      gzipSize: true,
      brotliSize: true,
    })] : []),
  ],
  server: {
    host: '172.48.0.115',
    port: 5173,
    strictPort: true,
    hmr: {
      overlay: false // ปิด error overlay ถ้าไม่ต้องการ
    },
    fs: {
      strict: true, // จำกัดการเข้าถึงไฟล์นอก project root
      allow: ['..'], // อนุญาตให้เข้าถึงเฉพาะ directory ที่จำเป็น
    },
  },
  cacheDir: 'node_modules/.vite_cache',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
         'react-dom': 'react-dom', // ถ้าใช้ react-hot-loader
    },
    extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json'], // ลดเวลา lookup
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'recharts',
      'lodash-es',
      '@emotion/react',
      '@emotion/styled',
    ],
    exclude: ['moment', 'date-fns'], // ไลบรารีที่ใช้ dynamic imports
    esbuildOptions: {
      target: 'es2020',
    },
  },
  esbuild: {
    target: 'es2020',
    jsxFactory: 'React.createElement',
    jsxFragment: 'React.Fragment',
    treeShaking: true,
    // build production: ตัด console.log/info/debug ออก (console.error/warn ยังอยู่) — dev ไม่กระทบ
    ...(command === 'build' ? { pure: ['console.log', 'console.info', 'console.debug'] } : {}),
  },
  build: {
    target: 'es2020',
    minify: 'esbuild',
    sourcemap: process.env.NODE_ENV !== 'production', // ปิดใน production
    cssCodeSplit: true,
    chunkSizeWarningLimit: 800, // เพิ่ม limit สำหรับแอปขนาดใหญ่
    reportCompressedSize: false, // ปิดการรายงานขนาด compressed
    emptyOutDir: true, // ล้างไฟล์เก่าก่อน build ใหม่
    rollupOptions: {
      output: {
        generatedCode: {
          constBindings: true,
        },
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('@emotion') || id.includes('react-dom') || id.includes('react-router')) return 'react-vendor';
            if (id.includes('recharts') || id.includes('chart.js') || id.includes('react-chartjs')) return 'charts-vendor';
            if (id.includes('lodash')) return 'lodash-vendor';
            if (id.includes('axios')) return 'axios-vendor';
            if (id.includes('@mui') || id.includes('@chakra-ui') || id.includes('@ark-ui') || id.includes('lucide-react')) return 'ui-vendor';
            if (id.includes('pdfjs-dist') || id.includes('jspdf')) return 'pdf-vendor';
            if (id.includes('framer-motion')) return 'animation-vendor';
            if (id.includes('socket.io')) return 'socket-vendor';
            return 'vendor';
          }
        },
        entryFileNames: `assets/[name]-[hash].js`,
        chunkFileNames: `assets/[name]-[hash].js`,
        assetFileNames: `assets/[name]-[hash].[ext]`,
      },
      onwarn(warning, warn) {
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE') return;
        warn(warning);
      },
    },
  },
  preview: {
    port: 5173,
    strictPort: true,
  },
}));
