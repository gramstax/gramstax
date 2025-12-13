import js from "@eslint/js"
import globals from "globals"
import tseslint from "typescript-eslint"
import { defineConfig } from "eslint/config"

export default defineConfig([
  tseslint.configs.recommended,
  {
    ignores: [`node_modules/`, `.nx/`, `**/dist/`]
  },
  {
    files: [`**/*.{js,mjs,cjs,ts,mts,cts}`],
    plugins: { js },
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
      "no-unused-vars": `off` // ⬅️ Accept declaration variable without not used (javascript)
    }
  }
])

// export default defineConfig([
//   tseslint.configs.recommendedTypeChecked,
//   {
//     languageOptions: {
//       parserOptions: {
//         projectService: true
//       }
//     }
//   },
//   {
//     ignores: [`node_modules/`, `.nx/`, `**/dist/`]
//   },
//   {
//     files: [`**/*.{js,mjs,cjs,ts,mts,cts}`],
//     plugins: { js },
//     extends: [`js/recommended`],
//     languageOptions: {
//       globals: {
//         ...globals.node,
//         Bun: true, // ⬅️ Accept syntax Bun
//         Worker: true // ⬅️ Accept syntax Worker
//       }
//     },
//     rules: {
//       quotes: [`warn`, `backtick`], // ⬅️ Force use backtick | example: const data = `Hello`
//       "@typescript-eslint/no-explicit-any": `off`, // ⬅️ Accept any | example: const data: any = {}
//       "@typescript-eslint/no-unused-vars": `off`, // ⬅️ Accept declaration variable without not used (declare variable but not used) | example: const data = {}
//       "@typescript-eslint/no-unsafe-return": `off`, // ⬅️ Accept unsafe return | example: return {} as any
//       "@typescript-eslint/no-unsafe-assignment": `off`, // ⬅️ Accept unsafe assignment | example: const data = {} as any
//       "@typescript-eslint/no-misused-promises": `off`, // ⬅️ Accept misused promises | example: const mock = (params: () => void) => params(); mock(async() => 100)
//       "@typescript-eslint/no-floating-promises": `off`, // ⬅️ Accept floating promises (run function async without await) | example: const mock = async() => {}; mock()
//       "@typescript-eslint/no-implied-eval": `off`, // ⬅️ Accept implied eval | example: new Function(`data`, `return {}`)
//       "@typescript-eslint/no-unsafe-member-access": `off`, // ⬅️ Accept unsafe member access | example: const data = {} as any; data?.test
//       "@typescript-eslint/unbound-method": `off`, // ⬅️ Accept unbound method
//       // ===
//       "no-unused-vars": `off` // ⬅️ Accept declaration variable without not used (javascript)
//     }
//   }
// ])
