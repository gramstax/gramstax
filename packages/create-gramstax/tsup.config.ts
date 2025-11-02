import { defineConfig } from "tsup"
import { cpSync, rmdirSync } from "node:fs"

// hard clean
try {
  rmdirSync(`./dist`)
} catch {
  //
}

export default defineConfig({
  outDir: `./dist/src`,
  entry: [`./src/index.ts`],
  format: [`cjs`, `esm`],
  cjsInterop: true,
  dts: true,
  clean: true,
  minify: true,
  sourcemap: false,
  keepNames: true,
  platform: `node`,
  target: `esnext`,
  external: [`bun`, `src/templates`],
  onSuccess() {
    cpSync(`./src/templates`, `./dist/src/templates`, { recursive: true })
    return undefined as any
  }
})
