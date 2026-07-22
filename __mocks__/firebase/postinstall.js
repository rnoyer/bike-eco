/**
 * Manual Jest mock for @firebase/util's dist/postinstall.mjs.
 * That file is plain ESM (`export { ... }`) with a `.mjs` extension, which
 * falls outside jest-expo's transform regex (`\.[jt]sx?$`), so requiring it
 * unmocked throws a raw "Unexpected token 'export'" SyntaxError. The real
 * function only ever returns `undefined` outside of Firebase's own
 * postinstall step, so mocking it is behavior-preserving.
 */
module.exports = { getDefaultsFromPostinstall: () => undefined };
