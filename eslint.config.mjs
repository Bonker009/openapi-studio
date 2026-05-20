import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Existing codebase uses `any` in several places; tighten gradually.
      "@typescript-eslint/no-explicit-any": "warn",
      // New React Compiler–oriented rules; refactoring effects is a larger follow-up.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/immutability": "off",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
