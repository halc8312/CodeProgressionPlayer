/* eslint-env node */
module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
  ],
  env: {
    browser: true,
    es2021: true,
  },
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: "module",
  },
  ignorePatterns: ["dist", "node_modules", "*.cjs"],
  rules: {
    "@typescript-eslint/no-non-null-assertion": "off",
  },
};
