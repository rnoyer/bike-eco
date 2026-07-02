/**
 * Manual Jest mock for firebase/firestore.
 * Provides a lightweight Timestamp class compatible with the real API surface
 * used in fixtures (Timestamp.fromDate, seconds/nanoseconds).
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

  toDate() {
    return new Date(this.seconds * 1000 + this.nanoseconds / 1_000_000);
  }

  toMillis() {
    return this.seconds * 1000 + this.nanoseconds / 1_000_000;
  }
}

module.exports = { Timestamp };
