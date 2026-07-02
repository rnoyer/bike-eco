// Silences the native-animation warning and provides a default kv-store mock
// fallback. Individual tests override the kv-store mock as needed.
jest.mock('expo-sqlite/kv-store', () => {
  const store = new Map();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (k) => (store.has(k) ? store.get(k) : null)),
      setItem: jest.fn(async (k, v) => void store.set(k, v)),
      removeItem: jest.fn(async (k) => void store.delete(k)),
    },
  };
});
