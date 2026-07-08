# Shipping Envoy to Android (EAS Build + Play Store)

This is the **Twilio-number path** — the shippable, cross-platform default. It does
NOT request restricted SMS permissions (they're blocked in `app.json` on purpose), so
it avoids Google's SMS/Call-Log permissions review. The native default-SMS handler is a
separate premium Android tier tracked in `docs/ANDROID_SMS.md`.

## Prerequisites (one-time)
1. **Expo account** — sign up free at https://expo.dev. Install the CLI: `npm i -g eas-cli`, then `eas login`.
2. **Google Play Developer account** — https://play.google.com/console ($25 one-time).
3. **A deployed backend URL** — the app needs `EXPO_PUBLIC_API_URL` to point at a public
   backend (not localhost). Deploy `server/` somewhere (Fly.io, Railway, Render, etc.) and
   put the HTTPS URL into `eas.json` (replace `REPLACE_WITH_BACKEND_URL` in the `preview`
   and `production` profiles).

## First-time project link
```
cd app
eas init          # creates the EAS project, fills extra.eas.projectId in app.json
```
(This replaces the `REPLACE_WITH_EAS_PROJECT_ID` placeholder.)

## Build an installable APK to sideload on your phone (fastest way to hold it)
```
cd app
npm run build:preview        # eas build --profile preview --platform android
```
- Produces a downloadable **APK**. EAS prints a URL; open it on your Android phone and
  install (enable "install from unknown sources" when prompted).
- Use this to test on a real device before touching the Play Store.

## Build the Play Store bundle (.aab) and submit
```
cd app
npm run build:production      # produces an .aab, auto-increments versionCode
npm run submit:production     # uploads to Play Console (needs a service-account key)
```
- For `submit`, follow EAS's prompt to set up a Google Play **service account JSON**
  (Play Console → Setup → API access). EAS stores it for future submits.
- Alternatively, download the `.aab` from the EAS build page and upload it manually in
  Play Console → Production → Create release.

## Play Console listing checklist (Twilio path)
- App name: **Envoy** (or "Envoy — AI Secretary")
- Short + full description (see `docs/STORE_LISTING.md`)
- App icon 512×512, feature graphic 1024×500, ≥2 phone screenshots
- **Privacy policy URL** — host `PRIVACY_POLICY.md` content somewhere public and link it
- Data safety form — declare what the backend collects (messages sent to OpenAI, etc.)
- Content rating questionnaire
- Since we request **no** restricted permissions on this path, there's no SMS/Call-Log
  Permissions Declaration to file. (That changes when the native SMS tier ships.)

## Versioning
- `appVersionSource: remote` in `eas.json` — EAS manages `versionCode` (auto-increment on
  production builds). Bump the human-facing `version` in `app.json` for each release.
