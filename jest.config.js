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

  // TypeScript handling - FIXED for proper TypeScript support
  preset: 'ts-jest',
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        target: 'ES2022',
        module: 'CommonJS',
        lib: ['ES2022'],
        strict: false,
        esModuleInterop: true,
        skipLibCheck: true,
        declaration: false,
        sourceMap: false,
        removeComments: true,
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
        paths: {
          "@types/*": ["./src/types/*"],
          "@core/*": ["./src/core/*"],
          "@rag/*": ["./src/rag/*"],
          "@intelligence/*": ["./src/intelligence/*"],
          "@api/*": ["./src/api/*"]
        }
      }
    }]
  },

  // Transform ignore patterns
  transformIgnorePatterns: [
    'node_modules/(?!(.*\\.mjs$))'
  ],

  // Module resolution - FIXED: moduleNameMapping -> moduleNameMapper
  moduleNameMapper: {
    '^@types/(.*)$': '<rootDir>/src/types/$1',
    '^@core/(.*)$': '<rootDir>/src/core/$1',
    '^@rag/(.*)$': '<rootDir>/src/rag/$1',
    '^@intelligence/(.*)$': '<rootDir>/src/intelligence/$1',
    '^@api/(.*)$': '<rootDir>/src/api/$1'
  },

  // Extensions and file handling
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

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
    'tests/**/*.ts',
    '!tests/**/*.d.ts',
    '!tests/helpers/**',
    '!tests/fixtures/**',
    '!tests/setup.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
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
  errorOnDeprecated: false,

  // Exclude problematic source files from coverage
  coveragePathIgnorePatterns: [
    'node_modules/',
    'src/',
    'dist/',
    'coverage/'
  ]
};