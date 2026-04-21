/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  setupFiles: ['<rootDir>/src/__tests__/setup.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/__tests__/**', '!src/app.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: { strict: true, esModuleInterop: true } }],
  },
};
