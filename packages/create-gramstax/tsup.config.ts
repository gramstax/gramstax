import {defineConfig} from "tsup"

import {cpSync, readFileSync, rmdirSync, writeFileSync} from "node:fs"

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
  tsconfig: `./tsconfig.build.json`,
  onSuccess() {
    const read = (path: string) => readFileSync(path, `utf-8`)
    const readJson = (path: string) => JSON.parse(read(path)) as Record<any, any>

    // copy templates to dist/templates
    cpSync(`./src/templates`, `./dist/src/templates`, {recursive: true})

    // path dist/templates
    const pathDistPackageJson = `./dist/src/templates/package.json`
    const pathDistTsconfigJson = `./dist/src/templates/tsconfig.json`

    // read json from dist/templates
    const distPackageJson = readJson(pathDistPackageJson)
    let distTsconfigJson = read(pathDistTsconfigJson)

    // read from ./package.json and set gramstax to latest number version
    const thisPackageJson = readJson(`./package.json`)
    distPackageJson.dependencies.gramstax = `^${thisPackageJson.version}`

    // delete gramstax from tsconfig.json dist templates, because that is for dev only
    distTsconfigJson = distTsconfigJson.replace(/,?\s*\n\s*"gramstax":\s*\[\s*"\.\.\/\.\.\/\.\.\/gramstax\/src\/index\.ts"\s*\]/g, ``)

    // update package.json dist/templates
    writeFileSync(pathDistPackageJson, JSON.stringify(distPackageJson, null, 2), `utf8`)

    // update tsconfig.json dist/templates
    writeFileSync(pathDistTsconfigJson, distTsconfigJson, `utf8`)

    return undefined as any
  },
  define: {
    // __PKG_VERSION__: JSON.stringify(version)
  }
})
