import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Les lignes de mysql2 sont typees `any[]` (RowDataPacket generique) :
      // motif idiomatique cote acces BDD. On garde l'alerte sans bloquer la CI.
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Scripts de test crypto (round-trip primitives).
    "test/**",
  ]),
]);

export default eslintConfig;
