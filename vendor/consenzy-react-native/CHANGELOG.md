# Changelog

All notable changes to `@onfinance/consenzy-react-native` are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the package uses
[Semantic Versioning](https://semver.org/).

## Unreleased

- `DataRequest` gains optional `channel` and `channel_reference`: the channel a rights request
  arrived on (in-app requests are recorded as `"app"`). `RightsRequestForm`'s past-requests list
  shows "via WhatsApp", "via branch" etc. for requests filed by the backend from other channels.

## 0.1.0

First public release, under the Apache License 2.0 (previously distributed privately as
`@onfinance/consent-sdk-react-native`).

- `ConsentProvider` and hooks (`useConsentSession`, `useNotice`, `useConsents`, `useDataRequests`,
  `useMe`, `useCapabilities`).
- Prebuilt screens: `ConsentSheet`, `ConsentManager`, `RightsRequestForm`, `BreachNotices`.
- `@onfinance/consenzy` is now a peer dependency.
