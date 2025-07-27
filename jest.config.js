/** @type {import('jest').Config} */
module.exports = {
  // Test environment
  testEnvironment: 'node',

  // Test file patterns
  testMatch: [
    '<rootDir>/tests/**/*.test.ts',
    '<rootDir>/tests/**/*.spec.ts',
    '<rootDir>/src/**/__tests__/**/*.test.ts',
    '<rootDir>/src/**/__tests__/**/*.spec.ts',
    '<rootDir>/src/tests/**/*.test.ts',
    '<rootDir>/src/tests/**/*.spec.ts'
  ],

  // TypeScript handling
  preset: 'ts-jest',
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },

  // Module resolution
  moduleNameMapping: {
    '^@types/(.*)$': '<rootDir>/src/types/$1',
    '^@core/(.*)$': '<rootDir>/src/core/$1',
    '^@rag/(.*)$': '<rootDir>/src/rag/$1',
    '^@intelligence/(.*)$': '<rootDir>/src/intelligence/$1',
    '^@api/(.*)$': '<rootDir>/src/api/$1'
  },

  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'lcov',
    'html',
    'json-summary'
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/**/index.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },

  // Test setup
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup.ts'
  ],

  // Test timeout
  testTimeout: 30000,

  // Clear mocks between tests
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,

  // Verbose output
  verbose: true,

  // Error handling
  errorOnDeprecated: true,

  // Globals
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json'
    }
  },

  // Test suites organization
  projects: [
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/tests/unit/**/*.test.ts', '<rootDir>/src/tests/unit/**/*.test.ts'],
      setupFilesAfterEnv: ['<rootDir>/tests/setup.ts']
    },
    {
      displayName: 'integration',
      testMatch: ['<rootDir>/tests/integration/**/*.test.ts', '<rootDir>/src/tests/integration/**/*.test.ts'],
      setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
      testTimeout: 60000
    },
    {
      displayName: 'performance',
      testMatch: ['<rootDir>/tests/performance/**/*.test.ts', '<rootDir>/src/tests/performance/**/*.test.ts'],
      setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
      testTimeout: 120000
    }
  ]
};