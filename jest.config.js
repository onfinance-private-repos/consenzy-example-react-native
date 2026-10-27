// jest-expo runs the tests in a React Native environment. The two Consenzy packages are vendored as TypeScript
// source (see vendor/*/README.md), so map them to their entry files; Jest then transforms them like app code.
module.exports = {
  preset: 'jest-expo',
  moduleNameMapper: {
    '^@onfinance/consenzy$': '<rootDir>/vendor/consenzy-js/src/index.ts',
    '^@onfinance/consenzy-react-native$': '<rootDir>/vendor/consenzy-react-native/src/index.ts',
  },
  // The first render test also pays for transforming React Native and the SDK.
  testTimeout: 30000,
  testPathIgnorePatterns: ['/node_modules/', '/vendor/', '/android/', '/ios/'],
};
