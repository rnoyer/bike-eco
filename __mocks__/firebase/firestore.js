/**
 * Manual Jest mock for firebase/firestore.
 * Provides a lightweight Timestamp class compatible with the real API surface
 * used in fixtures (Timestamp.fromDate, seconds/nanoseconds), plus no-op
 * stubs for the init/emulator functions `firebase.core.ts` calls at import
 * time so requiring it in tests doesn't need a live Firestore instance.
 */
class Timestamp {
  constructor(seconds, nanoseconds) {
    this.seconds = seconds;
    this.nanoseconds = nanoseconds;
  }

  static fromDate(date) {
    const seconds = Math.floor(date.getTime() / 1000);
    const nanoseconds = (date.getTime() % 1000) * 1_000_000;
    return new Timestamp(seconds, nanoseconds);
  }

  static now() {
    return Timestamp.fromDate(new Date());
  }

  toDate() {
    return new Date(this.seconds * 1000 + this.nanoseconds / 1_000_000);
  }

  toMillis() {
    return this.seconds * 1000 + this.nanoseconds / 1_000_000;
  }
}

module.exports = {
  Timestamp,
  getFirestore: () => ({}),
  connectFirestoreEmulator: () => {},
};
