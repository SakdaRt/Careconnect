/** @type {import('jest').Config} */
export default {
  testEnvironment: 'node',
  transform: {},
  collectCoverageFrom: ['src/**/*.js'],
  testTimeout: 30000,
  verbose: true,
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  projects: [
    {
      displayName: 'integration',
      testEnvironment: 'node',
      transform: {},
      testMatch: ['<rootDir>/tests/**/*.test.js'],
      setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
      testTimeout: 30000,
    },
    {
      displayName: 'unit',
      testEnvironment: 'node',
      transform: {},
      testMatch: ['<rootDir>/src/**/__tests__/**/*.test.js'],
      testTimeout: 15000,
    },
  ],
};

