import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({ root: '.', plugins: [react({ jsxImportSource: '@emotion/react' })], define: { 'import.meta.env.VITE_API_URL': '"http://localhost:5199"' }, server: { host: '127.0.0.1', port: 5200, strictPort: true, hmr: false } });
