module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/test'],
  testPathIgnorePatterns: ['<rootDir>/dist'],
};
