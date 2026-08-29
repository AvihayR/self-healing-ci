#!/usr/bin/env node
/**
 * Generates apps/web/src/api-types.ts from the zod contract in the API.
 *
 * The output is committed. CI runs `npm run gen:types:check`, which regenerates
 * and fails if anything moved — so changing an API shape without regenerating
 * breaks the build in a named, diagnosable way instead of surfacing as a
 * runtime surprise two directories away.
 *
 * Reads the compiled output rather than the TypeScript source so the script
 * runs identically on Node 22 and Node 26, with no type-stripping flag.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");
const compiled = join(repoRoot, "apps", "api", "dist", "schemas.js");
const target = join(repoRoot, "apps", "web", "src", "api-types.ts");

const { contract } = await import(pathToFileURL(compiled).href);

/** Print a zod schema as a TypeScript type expression. */
function print(schema, indent = 0) {
  const def = schema._def;
  const pad = "  ".repeat(indent + 1);
  const closePad = "  ".repeat(indent);

  switch (def.typeName) {
    case "ZodString":
      return "string";
    case "ZodNumber":
      return "number";
    case "ZodBoolean":
      return "boolean";
    case "ZodLiteral":
      return typeof def.value === "string" ? JSON.stringify(def.value) : String(def.value);
    case "ZodEnum":
      return def.values.map((value) => JSON.stringify(value)).join(" | ");
    case "ZodNullable":
      return `${print(def.innerType, indent)} | null`;
    case "ZodOptional":
      return `${print(def.innerType, indent)} | undefined`;
    case "ZodDefault":
      return print(def.innerType, indent);
    case "ZodArray":
      return `${print(def.type, indent)}[]`;
    case "ZodUnion":
      return def.options.map((option) => print(option, indent)).join(" | ");
    case "ZodObject": {
      const shape = def.shape();
      const lines = Object.entries(shape).map(([key, value]) => {
        const optional = value._def.typeName === "ZodOptional" || value._def.typeName === "ZodDefault";
        return `${pad}${key}${optional ? "?" : ""}: ${print(value, indent + 1)};`;
      });
      return `{\n${lines.join("\n")}\n${closePad}}`;
    }
    default:
      throw new Error(
        `gen-types does not know how to print ${def.typeName}. ` +
          `Extend the printer in scripts/gen-types.mjs rather than hand-editing api-types.ts.`,
      );
  }
}

const body = Object.entries(contract)
  .map(([name, schema]) => `export type ${name} = ${print(schema)};`)
  .join("\n\n");

const output = `// GENERATED FILE — DO NOT EDIT.
// Produced by scripts/gen-types.mjs from apps/api/src/schemas.ts.
// Run \`npm run gen:types\` after changing the contract; CI checks that doing so
// is a no-op, so an un-regenerated change fails the build rather than the user.

${body}
`;

let previous = null;
try {
  previous = readFileSync(target, "utf8");
} catch {
  // First run: the file does not exist yet.
}

if (previous === output) {
  console.log("api-types.ts is up to date");
} else {
  writeFileSync(target, output, "utf8");
  console.log(`wrote ${target}`);
}
