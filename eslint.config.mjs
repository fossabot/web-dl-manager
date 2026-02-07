import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import sonarjs from "eslint-plugin-sonarjs";
import promise from "eslint-plugin-promise";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  sonarjs.configs.recommended,
  promise.configs["flat/recommended"],
  {
    rules: {
      "sonarjs/no-duplicate-string": "off",
      "sonarjs/no-nested-template-literals": "warn",
      "promise/always-return": "warn",
      "promise/catch-or-return": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "public/sw.js",
    "public/workbox-*.js",
  ]),
]);

export default eslintConfig;
