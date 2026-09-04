> **Live project note:** invitations are deleted (not marked `expired`) once
> their `expiresAt` passes. Acceptance and a submitted-but-expired code delete
> the document inline (`functions/src/registration/core.ts`); an invitation that
> is simply never used is swept by a Firestore **TTL policy** on
> `invitations.expiresAt`.
>
> That policy is declared in `firestore.indexes.json` (`fieldOverrides`, `"ttl":
> true`) and ships with the indexes — it is **not** a manual console step:
>
> ```bash
> npx -y firebase-tools@latest deploy --only firestore:indexes --project bike-eco-43a84
> ```
>
> `firebase.json` pins `"database": "bike-eco-db"`, so this targets the named
> database. `expiresAt` is deliberately left unindexed (`"indexes": []`) —
> nothing filters or orders by it, and an indexed TTL field causes index churn.
> Verify with `gcloud firestore fields ttls list --database=bike-eco-db`.
> The emulator does not enforce TTL, so this has no effect on local testing.

## Launch the Firebase emulators

```bash
JAVA_HOME=/usr/local/jdk-26.0.1 PATH=/usr/local/jdk-26.0.1/bin:$PATH npx -y firebase-tools@latest emulators:start --only auth,firestore,storage,functions --project bike-eco-43a84
```

App data lives in the named `bike-eco-db` database:

[http://localhost:4000/firestore/bike-eco-db/data](http://localhost:4000/firestore/bike-eco-db/data)

## Launch android emulator

```bash
EXPO_PUBLIC_USE_EMULATORS=1 npx expo start
```

## Tests account (local):

- Populate with test users

```bash
npm run seed
```

- Test accounts :
  - b2b@garage-nord.fr / password123 → B2B dashboard;
  - b2b@garage-sud.fr / password123 → B2B dashboard;
  - bo@bike-eco.fr / password123 back-office;
  - pending@garage-nord.fr → pending gate → Se déconnecter returns to sign-in;

wipe the app's data via adb — that clears AsyncStorage, the Firebase Auth persisted session, and everything else in one shot:

```bash
adb shell pm clear com.bikeeco.app
```

### Firebase functions

```bash
# Update firebase functions locally
npm --prefix functions run build

# Push the functions to Firebase:
npx firebase-tools@latest deploy --only functions

```

## Build projects

### IOS

```bash
# Development build:
npx eas-cli@latest build -p ios --profile development

# Production build:
eas build --platform ios

```

### ANDROID

#### Check build will be okay

```bash
npx expo-doctor@latest
npx expo prebuild --platform android --clean
cd android && ./gradlew :app:processReleaseMainManifest
```

```bash
# Production Build:
eas build --platform android
```
