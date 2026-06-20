import {defineConfig} from "tsup"
import {rmdirSync} from "node:fs"

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
  tsconfig: `./tsconfig.build.json`,
  define: {
    // __PKG_VERSION__: JSON.stringify(version)
  },
  shims: true
})
