const js = require("@eslint/js");
const tseslint = require("typescript-eslint");

/**
 * Flat config (ESLint v9) for the Cloud Functions package. Aligns with the
 * surrounding Expo project's ESLint v9 toolchain so a bare `eslint` resolves
 * consistently regardless of cwd/PATH. Non-type-aware: lints fast without a
 * tsconfig project; `tsc` already enforces types via `npm run build`.
 */
module.exports = tseslint.config(
  { ignores: ["lib/**", "generated/**", "node_modules/**", "eslint.config.js"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts"],
    rules: {
      quotes: ["error", "double", { allowTemplateLiterals: true }],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  }
);
