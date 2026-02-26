module.exports = {
  coverageProvider: 'v8',
  collectCoverageFrom: ["js/**/*.js", "!js/**/*.test.js", "!js/**/__tests__/**", "!**/node_modules/**"],
  coverageDirectory: 'coverage',
  coverageReporters: ['json', 'html', 'lcov', 'text'],
  testEnvironment: 'jsdom',
  testMatch: ['**/tests/unit/**/*.test.js'],
  transform: {
    '^.+\.js$': 'babel-jest'
  },
  transformIgnorePatterns: ['/node_modules/']
};
