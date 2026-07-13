/**
 * Dedicated Jest config for Firestore rules unit tests
 * (`src/lib/firestore/__tests__/rules.test.ts`).
 *
 * These tests need the REAL `firebase/firestore` + `@firebase/rules-unit-testing`
 * SDKs talking to the Firestore emulator over HTTP. They deliberately do NOT use
 * the `jest-expo` preset configured in `package.json`'s `jest` key, because that
 * preset's `setupFiles` install Expo's own `expo/fetch` polyfill as
 * `globalThis.fetch`. That polyfill returns inert `FetchResponse` stand-ins
 * outside of a real Expo/React Native runtime (no native transport wired up),
 * so every HTTP call `@firebase/rules-unit-testing` makes to the emulator's
 * admin endpoints (hub discovery, load rules, clear data) silently resolves to
 * `{ ok: undefined, status: undefined }` and fails with
 * "HTTP Error undefined ... at undefined". Running this file under a plain
 * `node` Jest environment (no jest-expo setupFiles) keeps Node's real built-in
 * `fetch`, which these SDKs need.
 */
module.exports = {
  rootDir: __dirname,
  testEnvironment: "node",
  testMatch: ["<rootDir>/src/lib/firestore/__tests__/rules.test.ts"],
  transform: {
    "^.+\\.tsx?$": ["babel-jest", { presets: ["babel-preset-expo"] }],
  },
  transformIgnorePatterns: [
    "node_modules/(?!(firebase|@firebase)/)",
  ],
};
