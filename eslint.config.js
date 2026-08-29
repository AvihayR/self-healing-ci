import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

/**
 * One flat config for both workspaces.
 *
 * Type-aware rules are on. Without a type-checked lint the `lint` job would
 * only ever catch what `typecheck` already catches, and the two jobs the plan
 * asks for would be reporting the same failure twice — which is exactly the
 * lost distinction sitting 07's classifier needs to make.
 */
export default tseslint.config(
  {
    ignores: ["**/dist/**", "**/node_modules/**", "apps/web/src/api-types.ts"],
  },

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  {
    languageOptions: {
      parserOptions: {
        // Config and build scripts are plain JS with no owning tsconfig; the
        // default project lets them be linted without inventing one.
        projectService: {
          allowDefaultProject: ["eslint.config.js", "scripts/*.mjs"],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // The codebase distinguishes null (measured absence) from undefined
      // throughout; conflating them is the bug class this project exists to
      // catch, so the rule that encourages `??` over `||` stays on.
      "@typescript-eslint/prefer-nullish-coalescing": "error",
      "@typescript-eslint/no-unnecessary-condition": "error",
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-console": ["error", { allow: ["warn", "error"] }],
      eqeqeq: ["error", "always", { null: "ignore" }],
      // Off deliberately. The in-memory stores are async with nothing to await
      // because they satisfy interfaces whose real implementations — Postgres
      // and OpenSearch — are genuinely async. Dropping async there would mean
      // hand-wrapping every return in Promise.resolve to keep the contract.
      "@typescript-eslint/require-await": "off",
    },
  },

  {
    files: ["apps/api/**/*.ts", "scripts/**/*.mjs"],
    languageOptions: { globals: globals.node },
    rules: {
      // The API server and the seed script are the two places that legitimately
      // report to a terminal.
      "no-console": "off",
    },
  },

  {
    files: ["apps/web/**/*.{ts,tsx}"],
    languageOptions: { globals: globals.browser },
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },

  {
    files: ["**/*.test.ts"],
    rules: {
      "@typescript-eslint/no-unnecessary-condition": "off",
      // node:test's describe/it return promises that the runner owns and
      // awaits itself; every suite would otherwise need a void operator.
      "@typescript-eslint/no-floating-promises": "off",
    },
  },

  {
    // Build scripts and config files. `gen-types.mjs` walks zod's internals,
    // which are `any` by construction, so type-aware rules have nothing true to
    // say about it. Merge rather than replace: overriding `rules` after the
    // spread silently re-enables everything disableTypeChecked just turned off.
    files: ["scripts/**/*.mjs", "eslint.config.js", "**/vite.config.ts"],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: { globals: globals.node },
    rules: {
      ...tseslint.configs.disableTypeChecked.rules,
      "no-console": "off",
    },
  },
);
