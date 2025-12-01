/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        // Relax strict settings for tests
        noUnusedLocals: false,
        noUnusedParameters: false,
      },
    }],
  },
  moduleNameMapper: {
    // Handle .js extensions in imports (ESM style)
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  verbose: true,
};
