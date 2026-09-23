import {defineConfig} from "tsup"

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
  shims: true,
  platform: `node`,
  target: `esnext`,
  external: [`lmdb`, `tar`, `@aws-sdk/client-s3`],
  tsconfig: `./tsconfig.build.json`
})
