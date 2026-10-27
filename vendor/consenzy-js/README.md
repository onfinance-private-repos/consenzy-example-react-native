# Vendored: Consenzy JavaScript SDK

Vendored copy of the Consenzy JavaScript SDK (Apache-2.0, Copyright 2026 OnFinance) from version 0.1.0.
Temporary until the SDK is published to npm (`@onfinance/consenzy-react-native` / `@onfinance/consenzy`); switch to the
registry dependency then.

- Licence: [LICENSE](LICENSE) (Apache License 2.0) and [NOTICE](NOTICE). Changes: [CHANGELOG.md](CHANGELOG.md) (this
  copy is 0.1.0 plus the changes listed under "Unreleased" there).
- The source in `src/` is unmodified. The only change to `package.json` is that `devDependencies` and the
  `prepare`/`prepack` scripts were removed, so that `npm install` of this example does not run the `tsup` build.
  `tsup.config.ts` and the `tsconfig` files are kept so the package can still be built (`npx tsup`) if you need `dist/`.
- The example app uses only the browser/mobile-safe entry point (`ConsentSession`, errors, types). It resolves to
  `src/index.ts` via the package's `react-native` export condition (Metro), `paths` in the app's `tsconfig.json`
  (TypeScript) and `moduleNameMapper` in `jest.config.js` (Jest). The `server` and `widget` entry points are part of
  the package but are not used by the app; the org-key server client belongs on your backend, never in an app.

See [`../consenzy-react-native/README.md`](../consenzy-react-native/README.md) for how to switch to npm.
