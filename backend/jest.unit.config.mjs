/** @type {import('jest').Config} */
export default {
  testEnvironment: 'node',
  transform: {},
  testMatch: ['**/src/**/__tests__/**/*.test.js'],
  collectCoverageFrom: ['src/**/*.js'],
  // No setupFilesAfterSetup — unit tests mock their own deps
  testTimeout: 15000,
  verbose: true,
};
