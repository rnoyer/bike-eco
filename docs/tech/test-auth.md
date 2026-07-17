```bash
# Launch the Firebase emulators.
# JAVA_HOME is required: the default `java` is 17, which firebase-tools@latest refuses.
JAVA_HOME=/usr/local/jdk-26.0.1 PATH=/usr/local/jdk-26.0.1/bin:$PATH npx -y firebase-tools@latest emulators:start --only auth,firestore,storage --project bike-eco-43a84

# Populate with test users
npm run seed

# Inspect the data. The UI opens on `(default)`, which is EMPTY and always will be:
# app data lives in the named `bike-eco-db`. Ask for it by name or you'll see nothing.
# http://localhost:4000/firestore/bike-eco-db/data

# Launch android emulator
EXPO_PUBLIC_USE_EMULATORS=1 npx expo start


# Check:
# b2b@garage-nord.fr / password123 → B2B dashboard;
# pending@garage-nord.fr → pending gate → Se déconnecter returns to sign-in;
# bo@bike-eco.fr → back-office; wrong password → French error.

```

claude --resume 91cc2bf2-13f0-49ed-9b05-f25f8bc49b79
