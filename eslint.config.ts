import js from "@eslint/js"
import globals from "globals"
import tseslint from "typescript-eslint"
import json from "@eslint/json"
import { defineConfig } from "eslint/config"

export default defineConfig([
  { files: [`**/*.{js,mjs,cjs,ts,mts,cts}`], plugins: { js }, extends: [`js/recommended`], languageOptions: { globals: globals.node } },
  tseslint.configs.recommended,
  { files: [`**/*.json`], plugins: { json }, language: `json/json`, extends: [`json/recommended`] },
  {
    files: [`**/*.{js,mjs,cjs,ts,mts,cts}`],
    plugins: { js },
    extends: [`js/recommended`],
    languageOptions: {
      globals: { ...globals.node, Bun: true, Worker: true }
    },
    rules: {
      quotes: [`warn`, `backtick`],
      "@typescript-eslint/no-explicit-any": `off`,
      "@typescript-eslint/no-unused-vars": `off`,
      "no-unused-vars": `off`
    }
  }
])
