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
JAVA_HOME=/usr/local/jdk-26.0.1 PATH=/usr/local/jdk-26.0.1/bin:$PATH npx -y firebase-tools@latest emulators:start --only auth,firestore,storage,functions --project bike-eco-43a84

# app data lives in the named `bike-eco-db` database.
http://localhost:4000/firestore/bike-eco-db/data

# Launch android emulator
EXPO_PUBLIC_USE_EMULATORS=1 npx expo start
```

### Tests account (local):

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
