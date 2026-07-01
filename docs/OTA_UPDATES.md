# OTA updates

The Android app uses Capgo's Capacitor updater for over-the-air web bundle updates.

## What can ship OTA

- React, TypeScript, HTML, and CSS changes
- UI copy, layout, and styling fixes
- Frontend-only bug fixes
- API client changes bundled into the web app

## What still needs a new APK

- Android permissions
- AndroidManifest changes
- Capacitor plugin installs or upgrades
- Native Java/Kotlin changes
- App icon, app name, splash screen, signing, or package id changes

## One-time setup

Create a Capgo account and get an API key from the Capgo dashboard.

From the repo root:

```bash
npm run ota:init -- YOUR_CAPGO_API_KEY
```

Follow the prompts and connect the app id `com.oconnect.assistant`.

## Publish a web update

From the repo root:

```bash
npm run ota:upload
```

The script builds the mobile web bundle and uploads it to the `production` channel for `com.oconnect.assistant`. Devices with an OTA-enabled APK will download the update and apply it when the app backgrounds or restarts.

For a named test bundle:

```bash
cd frontend
npx @capgo/cli@latest bundle upload com.oconnect.assistant --path ./dist --channel production --bundle 1.0.1 --comment "Test OTA upload" --package-json ./package.json --node-modules ../node_modules
```

## First APK requirement

Users must install one APK that includes `@capgo/capacitor-updater`. After that APK is installed, frontend-only fixes can go through OTA.

## Safety checklist

1. Run `npm run build -w frontend`.
2. Test the web app locally.
3. If no native files changed, run `npm run ota:upload`.
4. If native files changed, rebuild and distribute a new APK instead.
