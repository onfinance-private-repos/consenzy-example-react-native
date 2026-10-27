# Consenzy React Native example

An Expo app that shows how to add DPDP Act, 2023 consent to a React Native app with the Consenzy React Native SDK
(`@onfinance/consenzy-react-native`, built on the core client `@onfinance/consenzy`):

- collect consent against an itemised notice, in the customer's language,
- check consent on the backend before using data for a purpose,
- let the customer review and withdraw consent,
- file and track Data Principal rights requests (access, correction, erasure, grievance, nomination),
- take consent for a minor from a verified guardian (s.9).

It runs with **no setup at all** (an in-app demo that fakes only the HTTP layer, so the real SDK code runs), against
the shared [example session server](https://github.com/never2average/consenzy-example-session-server), or against a
real Consenzy organisation through that server. All data is synthetic. The app never contains a Consenzy org API key
(`cdm_…`): it only ever holds short-lived principal session tokens (`cps_…`) minted by a backend.

## The journeys

Each journey is one screen in [`src/screens/`](src/screens). Most have a toggle between a custom screen built from the
SDK's hooks and the SDK's drop-in component.

| # | Journey | What it shows | Source |
|---|---|---|---|
| 1 | Consent collection | `useNotice(language)` with an English / Hindi / Tamil switch (Tamil is not published, so Consenzy falls back to English and the screen says so); the itemised notice: title, body, and per purpose the description, data categories and retention; switches that start **off**; recording only the selected purposes with `useConsentSession().giveConsent({ noticeId, purposeIds, channel: 'mobile_app' })`. Second tab: the drop-in `ConsentSheet`. | [`ConsentCollectionScreen.tsx`](src/screens/ConsentCollectionScreen.tsx) |
| 2 | Check before processing | "Send me offers" asks the backend to check the `marketing` purpose (`POST /consent-check` → Consenzy `POST /v1/consents/check`); the offer goes out only when `allowed`, and `consent_id` / `ledger_hash` are shown as the audit trail. Fails closed. Includes a one-tap marketing opt-in built with the hooks. | [`ConsentCheckScreen.tsx`](src/screens/ConsentCheckScreen.tsx) |
| 3 | Preferences centre | `useConsents({ activeOnly: true })` lists active consents; **Withdraw** opens an inline confirmation with an optional reason and calls `withdraw(id, reason)`, which refreshes the list. Second tab: the drop-in `ConsentManager`. | [`PreferencesScreen.tsx`](src/screens/PreferencesScreen.tsx) |
| 4 | Rights requests | Access, correction, erasure and grievance requests validated on the device with `validateRightsRequest` and filed with `useDataRequests().file`; status tracking from `useDataRequests().requests` with status, channel (the seeded erasure request "arrived on WhatsApp"), due date and refresh. Second tab: the drop-in `RightsRequestForm` with `showPastRequests`. | [`RightsScreen.tsx`](src/screens/RightsScreen.tsx) |
| 5 | Guardian consent | For the minor `CUST-DEMO-CHILD-7`: a session minted with `acting_as: "data_principal"` is refused with a 422 that `isGuardianRequiredError` recognises; a session minted with `acting_as: "guardian"` records consent; the guardian then files a nomination request (s.14). | [`GuardianScreen.tsx`](src/screens/GuardianScreen.tsx) |
| | Sign-in and home | Pick the mode and a demo customer (and, for the minor, child or guardian); the home screen shows the session's `acting_as` and capabilities, the five journeys as tabs, and **Log out** (`session.logout()` revokes the token). | [`SignInScreen.tsx`](src/screens/SignInScreen.tsx), [`HomeScreen.tsx`](src/screens/HomeScreen.tsx) |

Supporting code:

| What | Source |
|---|---|
| Session/token provider: mint a `cps_` session on the backend, build `ConsentSession` on the returned `base_url`, re-mint on expiry | [`src/consent/startSession.ts`](src/consent/startSession.ts) |
| `ConsentProvider` wiring (documented `baseUrl` + `sessionProvider` form for the session server; `session` prop for the in-app demo) | [`src/consent/AppConsentProvider.tsx`](src/consent/AppConsentProvider.tsx) |
| Session-server client (`/session`, `/consent-check`, `/demo-customers`) | [`src/backend/sessionServer.ts`](src/backend/sessionServer.ts) |
| In-app demo (demo only) | [`src/demo/`](src/demo) |
| Tests | [`__tests__/journeys.test.ts`](__tests__/journeys.test.ts), [`__tests__/screens.test.tsx`](__tests__/screens.test.tsx) |

## Run it

Requires Node.js 22.13+ or 24 and either Expo Go, an Android emulator or the iOS simulator.

```bash
npm ci
npx expo start          # then press a (Android) or i (iOS), or scan the QR code with Expo Go
```

The SDK has no native modules, so the app runs in Expo Go. To build the native Android app yourself (as CI does):

```bash
npx expo prebuild --platform android
cd android && ./gradlew assembleDebug
```

### Mode 1: in-app demo (default, zero setup)

Choose **In-app demo** on the sign-in screen (it is preselected), pick a customer and sign in. Nothing leaves the
device. The real `ConsentSession` and the real hooks and components run; only `fetch` is replaced
(`new ConsentSession({ baseUrl, sessionProvider, fetch })` is a documented option of the core SDK). The fake answers
`/v1/me/*` from the same synthetic data as the session server's demo mode
([`src/demo/fixtures.json`](src/demo/fixtures.json) is a copy of the server's), and a local stand-in mints sessions and
checks consent. Data lives in memory until the app restarts.

### Mode 2: session server (demo mode)

Run the shared backend on your machine:

```bash
git clone https://github.com/never2average/consenzy-example-session-server
cd consenzy-example-session-server && npm ci && npm start     # http://localhost:8787, demo mode
```

In the app choose **Session server**. The URL defaults to `http://10.0.2.2:8787` on Android (the emulator's address for
your machine) and `http://localhost:8787` on iOS. Change it on the sign-in screen, or set it before starting Metro:

```bash
cp .env.example .env     # then edit EXPO_PUBLIC_SESSION_SERVER_URL, e.g. http://192.168.1.20:8787 for a phone
```

Tap **Load demo customers**, pick one and sign in. The app calls `POST /session` and hands the returned `base_url`
and `cps_` token to the SDK; in demo mode the server also serves a mock `/v1/me/*`. Plain `http://` is accepted only for
this local setup (Android cleartext traffic is enabled through `expo-build-properties` and iOS allows local networking);
use HTTPS everywhere else.

### Mode 3: a real Consenzy organisation

Run the same session server in **live mode** with an org API key that has `sessions:mint` and `consents:check`
(for example against `https://consenzy.onfinance.ai` or your own deployment); see the server's README. The key stays in
the server's git-ignored `.env`. Create principals for the external references you want to use (or set
`ALLOWED_EXTERNAL_REFS`), then point the app at the server exactly as in mode 2. `/session` now returns your
deployment's `base_url`, and the SDK talks to it directly with the `cps_` token. Nothing in the app changes.

## Architecture

```
 App (this repo)                          Your backend                           Consenzy
 ────────────────                         ────────────                           ────────
 SignInScreen ──POST /session──────────▶  authenticate the customer
                                          mint session (org key, sessions:mint) ──▶ POST /v1/principal-sessions
              ◀── { token: cps_…, base_url, acting_as, capabilities, expires_at }
 ConsentProvider / ConsentSession ─────────────── /v1/me/*  Bearer cps_… ──────────▶ notice, consents, requests
 ConsentCheckScreen ──POST /consent-check──▶ check (org key, consents:check) ──────▶ POST /v1/consents/check
```

- [`startConsentSession`](src/consent/startSession.ts) mints the first session up front (its answer carries the base
  URL), then gives `ConsentSession` a `sessionProvider` that asks the backend again whenever the token is about to
  expire or is rejected with 401.
- In session-server mode the app uses the SDK's documented `<ConsentProvider baseUrl sessionProvider>` form. The in-app
  demo passes a ready-made `ConsentSession` (built with the demo `fetch`) through `<ConsentProvider session>`, because
  the provider's `baseUrl` form always uses the global `fetch`.
- The guardian journey creates its own headless `ConsentSession`s for the minor, one per `acting_as`, so it works
  whoever is signed in.
- [`src/demo/`](src/demo) is demo-only: `mockStore.ts` is a TypeScript port of the session server's `src/mock.js`
  (notice with fallback, grant with supersede, Idempotency-Key replay, withdraw, rights requests with validation and
  time-based status progression, the s.9 guardian rule, capabilities, logout), `demoFetch.ts` routes the SDK's
  requests to it, and `demoBackend.ts` plays the backend. Delete the folder and the in-app-demo option when you copy
  this app.
- **Before production:** your backend must derive the customer from its own login, never from the request body; mint
  `acting_as: "guardian"` only after authenticating the guardian; keep the TTL short; serve everything over HTTPS.

## Tests and CI

```bash
npm run typecheck
npm run lint
npm test
```

The tests run the journeys against the in-app demo with the real SDK (language fallback, grant → list → withdraw,
supersede, Idempotency-Key replay, consent check, filing and tracking requests with simulated time, guardian refusal
then success, nomination, logout, refusal of a `cdm_` key) and render every screen with
`@testing-library/react-native`. [CI](.github/workflows/ci.yml) runs typecheck, lint, tests and a Metro bundle on
every push and pull request, and builds the Android debug APK (`expo prebuild` + `./gradlew assembleDebug`).

## The vendored SDK

The SDK is not on npm yet, so this repository carries a copy: [`vendor/consenzy-react-native`](vendor/consenzy-react-native)
and [`vendor/consenzy-js`](vendor/consenzy-js), version 0.1.0, Apache-2.0, Copyright 2026 OnFinance, each with its
LICENSE, NOTICE and CHANGELOG. `package.json` depends on them with `file:` links and the app consumes their TypeScript
source (Metro via the packages' `react-native` export condition, TypeScript via `paths`, Jest via `moduleNameMapper`).
Once the packages are published, replace the `file:` dependencies with the registry versions and delete `vendor/`; see
[`vendor/consenzy-react-native/README.md`](vendor/consenzy-react-native/README.md).

## Related

- Session server: [never2average/consenzy-example-session-server](https://github.com/never2average/consenzy-example-session-server)
- Other example apps: [Android](https://github.com/never2average/consenzy-example-android),
  [iOS](https://github.com/never2average/consenzy-example-ios), [Flutter](https://github.com/never2average/consenzy-example-flutter)

## Licence

The example code is MIT licensed (see [LICENSE](LICENSE)). The vendored SDKs under `vendor/` are Apache-2.0 (see the
LICENSE and NOTICE in each). The Consenzy server and API are proprietary OnFinance software and are not part of this
repository.
