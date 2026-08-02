import {cpSync, readFileSync, rmSync, writeFileSync} from "node:fs"
import {defineConfig} from "tsup"

const read = (path: string) => readFileSync(path, `utf-8`)
const readJson = (path: string) => JSON.parse(read(path)) as {dependencies: Record<string, unknown>} & Record<string, unknown>
const thisPackageJson = readJson(`./package.json`)

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
  external: [`bun`, `src/templates`],
  tsconfig: `./tsconfig.build.json`,
  async onSuccess() {
    // copy templates to dist/templates
    rmSync(`./dist/src/templates`, {recursive: true, force: true})
    cpSync(`./src/templates`, `./dist/src/templates`, {recursive: true})

    // path dist/templates
    const pathDistPackageJson = `./dist/src/templates/package.json`
    const pathDistTsconfigJson = `./dist/src/templates/tsconfig.json`

    // read json from dist/templates
    const distPackageJson = readJson(pathDistPackageJson)
    let distTsconfigJson = read(pathDistTsconfigJson)

    const version = `^${thisPackageJson.version}`

    if (distPackageJson.dependencies) {
      for (const [name, val] of Object.entries(distPackageJson.dependencies)) {
        if (val === `workspace:*`) {
          distPackageJson.dependencies[name] = version
        }
      }
    }

    distTsconfigJson = distTsconfigJson.replace(/,?\s*\n\s*"(gramstax|@gramstax\/lmdb)":\s*\[[\s\S]*?\]/g, ``)

    // update package.json dist/templates
    writeFileSync(pathDistPackageJson, `${JSON.stringify(distPackageJson, null, 2)}\n`, `utf8`)

    // update tsconfig.json dist/templates
    writeFileSync(pathDistTsconfigJson, distTsconfigJson, `utf8`)
  },
  define: {}
})
