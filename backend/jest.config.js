/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src/__tests__'],
  testMatch: ['**/*.test.ts'],
  globals: {
    'ts-jest': {
      tsconfig: './tsconfig.test.json',
    },
  },
  // Setup global para todos los tests (silencia logs, helpers de aserción)
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup/jest.setup.ts'],
  moduleNameMapper: {
    '^@prisma/client$': '<rootDir>/src/__tests__/__mocks__/@prisma/client.ts',
  },
  collectCoverageFrom: [
    'src/services/**/*.ts',
    'src/middlewares/**/*.ts',
    'src/utils/**/*.ts',
    '!src/services/prisma.service.ts',
    '!src/services/redis.service.ts',
  ],
};
