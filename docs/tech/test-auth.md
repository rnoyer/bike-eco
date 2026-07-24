> **Live project note:** invitations are deleted (not marked `expired`) once
> their `expiresAt` passes, via a Firestore **TTL policy** on
> `invitations.expiresAt` — configure it once per environment:
>
> ```bash
> gcloud firestore fields ttls update expiresAt --collection-group=invitations --enable-ttl --database=bike-eco-db
> ```
>
> (Console equivalent: Firestore → the `bike-eco-db` database → TTL policies.)
> The emulator does not enforce TTL, so this has no effect on local testing.

```bash
# Launch the Firebase emulators.
# JAVA_HOME is required: the default `java` is 17, which firebase-tools@latest refuses.
JAVA_HOME=/usr/local/jdk-26.0.1 PATH=/usr/local/jdk-26.0.1/bin:$PATH npx -y firebase-tools@latest emulators:start --only auth,firestore,storage,functions --project bike-eco-43a84

# Populate with test users
npm run seed

# Inspect the data. The UI opens on `(default)`, which is EMPTY and always will be:
# app data lives in the named `bike-eco-db`. Ask for it by name or you'll see nothing.
# http://localhost:4000/firestore/bike-eco-db/data

# Launch android emulator
EXPO_PUBLIC_USE_EMULATORS=1 npx expo start


# Check:
# b2b@garage-nord.fr / password123 → B2B dashboard;
# b2b@garage-sud.fr / password123 → B2B dashboard;
# bo@bike-eco.fr → back-office; wrong password → French error.
# pending@garage-nord.fr → pending gate → Se déconnecter returns to sign-in;

```

wipe the app's data via adb — that clears AsyncStorage, the Firebase Auth persisted session, and everything else in one shot:

```bash
adb shell pm clear com.bikeeco.app
```

com.bikeeco.app is your android.package. After this, the next launch has no persisted user, so onAuthStateChanged fires with user = null (the silent path) — a genuine first-launch state.

A couple of practical notes:

- pm clear force-stops the app, so relaunch it afterward (`npx expo start` → press a, or tap the icon). The dev client reconnects to Metro fine — pm clear only wipes data, not the installed binary.
- Multiple emulators/devices connected? adb will complain it needs a target. List them and pick one:
  `adb devices`
  `adb -s emulator-5554 shell pm clear com.bikeeco.app`

Alternatives

- Just the auth session, keep other data: sign out from inside the app (useAuth().signOut()), or the settings screen's logout. This drops the Firebase session but leaves other AsyncStorage keys — good for testing "logged-out" without a full reset.
- Truly pristine (fresh install semantics): uninstall and let run:android reinstall:
  `adb uninstall com.bikeeco.app`
  `npx expo run:android`
- Use this if you also want to re-exercise first-run native permission prompts. It's heavier since it rebuilds/reinstalls.

For iterating on the auth/registration walkthrough, adb shell pm clear com.bikeeco.app between runs is the fast loop.
