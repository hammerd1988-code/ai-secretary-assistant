# Android SMS Integration

The Text Secretary needs to read incoming SMS, read the user's sent history
(style training), and send approved replies. On Android this requires the app
to hold the **SMS Role** (default SMS app) or, in the reduced Play-Store build,
the Notification Listener fallback.

`app/src/sms.ts` is the TypeScript bridge. It expects a native module named
`EnvoySms` with this interface:

```kotlin
// android/app/src/main/java/com/envoy/secretary/EnvoySmsModule.kt
class EnvoySmsModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  override fun getName() = "EnvoySms"

  // Prompt the user to grant the SMS role (RoleManager.ROLE_SMS).
  @ReactMethod fun requestSmsRole(promise: Promise) { /* ... */ }

  // Send an SMS via SmsManager and report delivery.
  @ReactMethod fun sendSms(to: String, body: String, promise: Promise) { /* ... */ }

  // Query content://sms/sent for style training.
  @ReactMethod fun readSentHistory(limit: Int, promise: Promise) { /* ... */ }
}
```

Incoming messages are delivered by a `BroadcastReceiver` for
`android.provider.Telephony.SMS_RECEIVED` (or `SMS_DELIVER` when holding the
SMS role) and emitted to JS as the `envoy_sms_received` event with
`{ from, body }`.

## Build steps

1. `npx expo prebuild --platform android` to generate the `android/` project.
2. Add the Kotlin module + receiver and register them in a `ReactPackage`.
3. Permissions are already declared in `app.json` (`READ_SMS`, `RECEIVE_SMS`,
   `SEND_SMS`, `READ_CONTACTS`).
4. Build a dev client: `npx expo run:android`.

## Play Store note

`SEND_SMS`/`READ_SMS` are restricted permissions. The Play build must either be
approved as a default-SMS-app use case via the Play Console permissions
declaration, or ship the Notification-Listener fallback (read-only triage +
share-sheet replies). The full-capability build can be distributed as a direct
APK. See `docs/PLAN.md` §2.
