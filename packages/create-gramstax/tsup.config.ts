import { defineConfig } from "tsup"
import { cpSync, readFileSync, rmdirSync, writeFileSync } from "node:fs"

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
  shims: true,
  onSuccess() {
    // copy templates
    cpSync(`./src/templates`, `./dist/src/templates`, { recursive: true })

    // set gramstax version in templates package.json
    const tplPackageJson = `./dist/src/templates/package.json`
    const packageJson = JSON.parse(readFileSync(tplPackageJson, `utf-8`))
    packageJson.dependencies.gramstax = `^${JSON.parse(readFileSync(`./package.json`, `utf-8`)).version}`

    writeFileSync(tplPackageJson, JSON.stringify(packageJson, null, 2))

    return undefined as any
  }
})
