import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Los tests de auth comparten una base real de Mongo (docker compose up mongo).
    fileParallelism: false,
    testTimeout: 20000,
    env: {
      NODE_ENV: 'test',
      MONGODB_URI: 'mongodb://localhost:27017/isaac-atlas-test',
      SESSION_SECRET: 'test-secret-test-secret',
      WEB_ORIGIN: 'http://localhost:5173',
      RATE_LIMIT_DISABLED: 'true',
      GOOGLE_CLIENT_ID: '',
      STEAM_API_KEY: '',
    },
  },
});
