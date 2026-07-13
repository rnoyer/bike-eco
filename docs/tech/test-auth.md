```bash
# launch Firebase emulator with JDK   27
JAVA_HOME=/usr/local/jdk-26.0.1 PATH=/usr/local/jdk-26.0.1/bin:$PATH npx -y firebase-tools@latest emulators:start


JAVA_HOME=/usr/local/jdk-26.0.1 PATH=/usr/local/jdk-26.0.1/bin:$PATH npx -y firebase-tools@latest emulators:start --only auth,firestore --project bike-eco-43a84
# Populate with test users
npm run seed

# Launch android emulator
EXPO_PUBLIC_USE_EMULATORS=1 npx expo start


# Check:
# b2b@garage-nord.fr / password123 → B2B dashboard;
# pending@garage-nord.fr → pending gate → Se déconnecter returns to sign-in;
# bo@bike-eco.fr → back-office; wrong password → French error.

```
