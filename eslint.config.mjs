import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

export default [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  { ignores: [".next/**", "node_modules/**"] },
  {
    rules: {
      // Standard convention: a leading underscore marks a parameter as
      // intentionally unused (e.g. a callback param required to match an
      // external library's type signature, but not needed in this
      // implementation) — not a real "forgot to use this" mistake.
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
];
