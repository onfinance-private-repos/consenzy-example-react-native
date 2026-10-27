# Vendored: Consenzy React Native SDK

Vendored copy of the Consenzy React Native SDK (Apache-2.0, Copyright 2026 OnFinance) from version 0.1.0.
Temporary until the SDK is published to npm (`@onfinance/consenzy-react-native` / `@onfinance/consenzy`); switch to the
registry dependency then.

- Licence: [LICENSE](LICENSE) (Apache License 2.0) and [NOTICE](NOTICE). Changes: [CHANGELOG.md](CHANGELOG.md) (this
  copy is 0.1.0 plus the changes listed under "Unreleased" there).
- The source in `src/` is unmodified. The only change to `package.json` is that `devDependencies` and the
  `prepare`/`prepack` scripts were removed, so that `npm install` of this example does not try to build the package
  or install a second copy of React Native.
- The app consumes the TypeScript source directly: Metro picks `src/index.ts` through the package's `react-native`
  export condition, TypeScript through `paths` in the app's `tsconfig.json`, and Jest through `moduleNameMapper` in
  `jest.config.js`. Nothing has to be built.

## Switching to npm

```bash
npm uninstall @onfinance/consenzy-react-native @onfinance/consenzy
npm install @onfinance/consenzy-react-native @onfinance/consenzy
rm -rf vendor
```

Then delete the two `paths` entries in `tsconfig.json` and the two `moduleNameMapper` entries in `jest.config.js`.
