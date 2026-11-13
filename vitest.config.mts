import { defineConfig } from 'vitest/config';
import path from 'node:path';

// 시험 설정: '@/...' 경로를 src 폴더로 연결한다.
export default defineConfig({
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
