# Android APK build

This project uses Capacitor to package the React frontend as an Android app.

## 1. Install Android tools

Install Android Studio, then install:

- Android SDK
- Android SDK Platform Tools
- Android SDK Build Tools
- JDK 17 or newer

After installing, open a new PowerShell window and confirm:

```powershell
java -version
```

## 2. Configure the mobile API URL

Copy the example mobile env file:

```powershell
Copy-Item frontend/.env.mobile.example frontend/.env.mobile
```

Edit `frontend/.env.mobile` and set your deployed backend URL:

```env
VITE_API_URL=https://your-render-backend.onrender.com/api
```

Do not use `localhost` here. A phone cannot reach your laptop's localhost.

## 3. Configure backend mobile redirect

In Render backend environment variables, set:

```env
MOBILE_APP_URL=oconnect://app
```

Keep your existing OAuth redirect URIs pointed to the backend callback URLs, for example:

```env
GOOGLE_REDIRECT_URI=https://your-render-backend.onrender.com/api/auth/google/callback
MICROSOFT_REDIRECT_URI=https://your-render-backend.onrender.com/api/auth/microsoft/callback
```

The backend will redirect web logins to `FRONTEND_URL` and mobile logins to `MOBILE_APP_URL`.

## 4. Sync Android project

From the project root:

```powershell
npm run android:sync
```

## 5. Build APK

Open Android Studio:

```powershell
npm run android:open
```

Then use:

```text
Build > Build Bundle(s) / APK(s) > Build APK(s)
```

The debug APK will be generated under:

```text
frontend/android/app/build/outputs/apk/debug/app-debug.apk
```

You can install that file on your Android phone for testing.

## Notes

- Google/Outlook login opens in the device browser and returns to the app through `oconnect://app/...`.
- For Play Store release, create a signed release build in Android Studio.
- If you change frontend code, run `npm run android:sync` again before rebuilding the APK.
