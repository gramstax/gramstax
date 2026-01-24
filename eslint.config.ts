import js from "@eslint/js"
import globals from "globals"
import tseslint from "typescript-eslint"
import {defineConfig} from "eslint/config"

export default defineConfig([
  tseslint.configs.recommended,
  {
    ignores: [`node_modules/`, `.nx/`, `**/dist/`, `.agents/`, `.claude/`, `.trae/`]
  },
  {
    files: [`**/*.{js,mjs,cjs,ts,mts,cts}`],
    plugins: {js},
    extends: [`js/recommended`],
    languageOptions: {
      globals: {
        ...globals.node,
        Bun: true, // ⬅️ Accept syntax Bun
        Worker: true // ⬅️ Accept syntax Worker
      }
    },
    rules: {
      quotes: [`warn`, `backtick`], // ⬅️ Force use backtick
      "@typescript-eslint/no-explicit-any": `off`, // ⬅️ Accept any
      "@typescript-eslint/no-unused-vars": `error`, // ⬅️ Accept declaration variable without not used
      "no-unused-vars": `off`, // ⬅️ Accept declaration variable without not used (javascript)
      "object-curly-spacing": [`error`, `never`] // ⬅️ Force delete space in object curly
    }
  }
])
