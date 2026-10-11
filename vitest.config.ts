import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.spec.ts', 'tests/**/*.spec.tsx'],
    environment: 'node',
    // Thread pool: the confined shell denies the piped child processes the
    // default forks pool needs.
    pool: 'threads',
  },
})
