import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM에서 __dirname 대체 방법
// 왜 이렇게 작성했는가?
// - ESM 모듈에서는 __dirname이 존재하지 않아 런타임 에러 발생
// - fileURLToPath와 import.meta.url을 사용하여 현재 디렉토리 경로 계산
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    server: {
        port: 5173,
        proxy: {
            '/api': {
                target: 'http://localhost:3100',
                changeOrigin: true,
            },
            '/ws': {
                target: 'ws://localhost:3100',
                ws: true,
            },
        },
    },
});
