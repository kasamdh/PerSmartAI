const expoPreset = require('jest-expo/jest-preset');

/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  // First run compiles the RN tree; keep cold-cache component tests from timing out.
  testTimeout: 15000,
  setupFiles: [...(expoPreset.setupFiles ?? []), '<rootDir>/jest.setup.js'],
  // Mirror the tsconfig `@/` path aliases, keeping the preset's own mappings.
  moduleNameMapper: {
    ...expoPreset.moduleNameMapper,
    '^@/assets/(.*)$': '<rootDir>/assets/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
