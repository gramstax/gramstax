import {cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {pathToFileURL} from "node:url"
import {describe, expect, it} from "bun:test"
import {GramstaxBuild} from "~/cli/build"
import {DEFAULT_CONFIG, GramstaxConfigLoader} from "~/cli/config"
import {GramstaxProgram} from "~/cli/gramstax"

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), `gramstax-cli-build-`))
}

function captureConsole(): {logs: string[]; errors: string[]; restore: () => void} {
  const logs: string[] = []
  const errors: string[] = []
  const originalLog = console.log
  const originalError = console.error
  console.log = (...args: unknown[]): void => {
    logs.push(args.map((arg) => String(arg)).join(` `))
  }
  console.error = (...args: unknown[]): void => {
    errors.push(args.map((arg) => String(arg)).join(` `))
  }
  return {
    errors,
    logs,
    restore: (): void => {
      console.log = originalLog
      console.error = originalError
    }
  }
}

describe(`gramstax build CLI`, () => {
  it(`--help exits 0 and lists build command`, async () => {
    const program = new GramstaxProgram().create()
    let output = ``
    program.configureOutput({
      writeErr: (text: string): void => {
        output += text
      },
      writeOut: (text: string): void => {
        output += text
      }
    })
    let thrown: unknown
    try {
      await program.parseAsync([`node`, `gramstax`, `--help`])
    } catch (error: unknown) {
      thrown = error
    }
    const commanderError = thrown as {code?: unknown; exitCode?: unknown}
    expect(commanderError.code).toBe(`commander.helpDisplayed`)
    expect(commanderError.exitCode).toBe(0)
    expect(output).toContain(`build`)
  })

  it(`missing src/pages exits non-zero with clear message`, async () => {
    const dir = makeTempDir()
    const capture = captureConsole()
    try {
      const code = await new GramstaxBuild().run([], dir)
      expect(code).not.toBe(0)
      expect(capture.errors.join(`\n`)).toContain(`pages directory not found`)
    } finally {
      capture.restore()
      rmSync(dir, {force: true, recursive: true})
    }
  })

  it(`--pagesDir is rejected as unknown option`, async () => {
    let message = ``
    try {
      await new GramstaxBuild().run([`--pagesDir`, `src/pages`])
    } catch (error: unknown) {
      message = error instanceof Error ? error.message : String(error)
    }
    expect(message).toContain(`unknown option`)
    expect(message).toContain(`--pagesDir`)
  })

  it(`--outDir is rejected as unknown option`, async () => {
    let message = ``
    try {
      await new GramstaxBuild().run([`--outDir`, `.gramstax`])
    } catch (error: unknown) {
      message = error instanceof Error ? error.message : String(error)
    }
    expect(message).toContain(`unknown option`)
    expect(message).toContain(`--outDir`)
  })

  it(`--dry-run prints resolved plan with sources and writes nothing`, async () => {
    const dir = makeTempDir()
    mkdirSync(join(dir, `src`, `pages`), {recursive: true})
    const capture = captureConsole()
    try {
      const code = await new GramstaxBuild().run([`--dry-run`], dir)
      expect(code).toBe(0)
      const printed = capture.logs.join(`\n`)
      expect(printed).toContain(`gramstax build plan`)
      expect(printed).toContain(`pagesDir: src/pages`)
      expect(printed).toContain(`outDir: .gramstax`)
      expect(printed).toContain(`targets: `)
      expect(printed).toContain(`deploy: polling (default)`)
      expect(printed).toContain(`optionsDeploy.adapter:  (default)`)
      expect(printed).toContain(`optionsDeploy.name:  (default)`)
      expect(printed).toContain(`optionsDeploy.url:  (default)`)
      expect(printed).toContain(`dry-run: no files written`)
      const order = [`gramstax build plan`, `pagesDir:`, `outDir:`, `targets:`, `deploy:`, `optionsDeploy.adapter:`, `optionsDeploy.name:`, `optionsDeploy.url:`, `dry-run: no files written`]
      let last = -1
      for (const marker of order) {
        const at = printed.indexOf(marker)
        expect(at).toBeGreaterThan(last)
        last = at
      }
      expect(existsSync(join(dir, `.gramstax`))).toBe(false)
    } finally {
      capture.restore()
      rmSync(dir, {force: true, recursive: true})
    }
  })

  it(`--check is rejected as unknown option`, async () => {
    let message = ``
    try {
      await new GramstaxBuild().run([`--check`])
    } catch (error: unknown) {
      message = error instanceof Error ? error.message : String(error)
    }
    expect(message).toContain(`unknown option`)
    expect(message).toContain(`--check`)
  })

  it(`--dry-run with --target prints the single effective target`, async () => {
    const dir = makeTempDir()
    mkdirSync(join(dir, `src`, `pages`), {recursive: true})
    writeFileSync(join(dir, `gramstax.config.ts`), `export default {deploy: \`serverless\`, optionsDeploy: {adapter: \`aws-lambda-async\`, url: \`https://example.com/webhook\`}}\n`, `utf-8`)
    const capture = captureConsole()
    try {
      const code = await new GramstaxBuild().run([`--target`, `lambda`, `--dry-run`], dir)
      expect(code).toBe(0)
      const lines = capture.logs.join(`\n`).split(`\n`)
      expect(lines).toContain(`targets: lambda`)
      expect(lines).toContain(`optionsDeploy.adapter: aws-lambda-async (flag)`)
      expect(lines).toContain(`dry-run: no files written`)
      expect(existsSync(join(dir, `.gramstax`))).toBe(false)
    } finally {
      capture.restore()
      rmSync(dir, {force: true, recursive: true})
    }
  })

  it(`--dry-run prints convention paths without config file or flags`, async () => {
    const dir = makeTempDir()
    mkdirSync(join(dir, `src`, `pages`), {recursive: true})
    const capture = captureConsole()
    try {
      const code = await new GramstaxBuild().run([`--dry-run`], dir)
      expect(code).toBe(0)
      const lines = capture.logs.join(`\n`).split(`\n`)
      expect(lines).toContain(`pagesDir: src/pages`)
      expect(lines).toContain(`outDir: .gramstax`)
      expect(lines).toContain(`targets: `)
      expect(lines).toContain(`deploy: polling (default)`)
      expect(lines).toContain(`optionsDeploy.adapter:  (default)`)
      expect(lines).toContain(`optionsDeploy.name:  (default)`)
      expect(lines).toContain(`optionsDeploy.url:  (default)`)
      expect(lines).toContain(`dry-run: no files written`)
      expect(existsSync(join(dir, `.gramstax`))).toBe(false)
    } finally {
      capture.restore()
      rmSync(dir, {force: true, recursive: true})
    }
  })

  it(`--dry-run annotates config sources when gramstax.config.ts defines deploy keys`, async () => {
    const dir = makeTempDir()
    mkdirSync(join(dir, `src`, `pages`), {recursive: true})
    writeFileSync(join(dir, `gramstax.config.ts`), `export default {deploy: \`serverless\`, optionsDeploy: {adapter: \`cloudflare-mod\`, name: \`cfg-worker\`, url: \`https://cfg-worker.example.workers.dev/webhook\`}}\n`, `utf-8`)
    const capture = captureConsole()
    try {
      const code = await new GramstaxBuild().run([`--dry-run`], dir)
      expect(code).toBe(0)
      const lines = capture.logs.join(`\n`).split(`\n`)
      expect(lines).toContain(`pagesDir: src/pages`)
      expect(lines).toContain(`outDir: .gramstax`)
      expect(lines).toContain(`targets: cloudflare-workers`)
      expect(lines).toContain(`deploy: serverless (config)`)
      expect(lines).toContain(`optionsDeploy.adapter: cloudflare-mod (config)`)
      expect(lines).toContain(`optionsDeploy.name: cfg-worker (config)`)
      expect(lines).toContain(`optionsDeploy.url: https://cfg-worker.example.workers.dev/webhook (config)`)
      expect(lines).toContain(`dry-run: no files written`)
      expect(existsSync(join(dir, `.gramstax`))).toBe(false)
    } finally {
      capture.restore()
      rmSync(dir, {force: true, recursive: true})
    }
  })

  it(`loadConfig returns defaults without config file`, async () => {
    const dir = makeTempDir()
    try {
      const config = await new GramstaxConfigLoader().loadConfig(dir)
      expect(config).toEqual(DEFAULT_CONFIG)
    } finally {
      rmSync(dir, {force: true, recursive: true})
    }
  })

  it(`loadConfig rejects pagesDir as unknown field`, async () => {
    const dir = makeTempDir()
    try {
      writeFileSync(join(dir, `gramstax.config.ts`), `export default {pagesDir: 42}\n`, `utf-8`)
      let message = ``
      try {
        await new GramstaxConfigLoader().loadConfig(dir)
      } catch (error: unknown) {
        message = error instanceof Error ? error.message : String(error)
      }
      expect(message).toContain(`unknown field`)
      expect(message).toContain(`pagesDir`)
    } finally {
      rmSync(dir, {force: true, recursive: true})
    }
  })

  it(`loadConfig accepts optionsDeploy adapter/name/url`, async () => {
    const dir = makeTempDir()
    try {
      writeFileSync(join(dir, `gramstax.config.ts`), `export default {deploy: \`serverless\`, optionsDeploy: {adapter: \`cloudflare-mod\`, name: \`my-worker\`, url: \`https://my-worker.example.workers.dev/webhook\`}}\n`, `utf-8`)
      const config = await new GramstaxConfigLoader().loadConfig(dir)
      expect(config.deploy).toBe(`serverless`)
      expect(config.optionsDeploy?.adapter).toBe(`cloudflare-mod`)
      expect(config.optionsDeploy?.name).toBe(`my-worker`)
      expect(config.optionsDeploy?.url).toBe(`https://my-worker.example.workers.dev/webhook`)
    } finally {
      rmSync(dir, {force: true, recursive: true})
    }
  })

  it(`loadConfig rejects unknown adapter naming valid adapters`, async () => {
    const dir = makeTempDir()
    try {
      writeFileSync(join(dir, `gramstax.config.ts`), `export default {optionsDeploy: {adapter: \`unknown-adapter\`}}\n`, `utf-8`)
      let message = ``
      try {
        await new GramstaxConfigLoader().loadConfig(dir)
      } catch (error: unknown) {
        message = error instanceof Error ? error.message : String(error)
      }
      expect(message).toContain(`Invalid gramstax config`)
      expect(message).toContain(`cloudflare-mod`)
      expect(message).toContain(`aws-lambda-async`)
    } finally {
      rmSync(dir, {force: true, recursive: true})
    }
  })

  it(`loadConfig rejects unknown field inside optionsDeploy`, async () => {
    const dir = makeTempDir()
    try {
      writeFileSync(join(dir, `gramstax.config.ts`), `export default {optionsDeploy: {bogus: \`x\`}}\n`, `utf-8`)
      let message = ``
      try {
        await new GramstaxConfigLoader().loadConfig(dir)
      } catch (error: unknown) {
        message = error instanceof Error ? error.message : String(error)
      }
      expect(message).toContain(`Invalid gramstax config`)
      expect(message).toContain(`bogus`)
    } finally {
      rmSync(dir, {force: true, recursive: true})
    }
  })

  it(`loadConfig rejects bad deploy and non-string optionsDeploy fields`, async () => {
    const cases: Array<{file: string; field: string}> = [
      {file: `export default {deploy: \`bogus\`}\n`, field: `polling`},
      {file: `export default {deploy: \`webhook:https://example.com/hook\`}\n`, field: `webhook`},
      {file: `export default {optionsDeploy: {adapter: 42}}\n`, field: `adapter`},
      {file: `export default {optionsDeploy: {adapter: \`nope\`}}\n`, field: `cloudflare-mod`},
      {file: `export default {optionsDeploy: {name: 42}}\n`, field: `name`},
      {file: `export default {optionsDeploy: {url: 42}}\n`, field: `url`},
      {file: `export default {optionsDeploy: 42}\n`, field: `optionsDeploy`},
      {file: `export default {optionsDeploy: {bogus: 1}}\n`, field: `bogus`}
    ]
    for (const entry of cases) {
      const dir = makeTempDir()
      try {
        writeFileSync(join(dir, `gramstax.config.ts`), entry.file, `utf-8`)
        let message = ``
        try {
          await new GramstaxConfigLoader().loadConfig(dir)
        } catch (error: unknown) {
          message = error instanceof Error ? error.message : String(error)
        }
        expect(message).toContain(`Invalid gramstax config`)
        expect(message).toContain(entry.field)
      } finally {
        rmSync(dir, {force: true, recursive: true})
      }
    }
  })

  it(`bare build with cloudflare-mod adapter emits worker set only`, async () => {
    const dir = makeTempDir()
    try {
      cpSync(join(import.meta.dir, `fixtures`, `manifest`, `pages`), join(dir, `src`, `pages`), {recursive: true})
      const ctxAbs = pathToFileURL(join(import.meta.dir, `..`, `src`, `core`, `ctx.ts`)).href
      const walk = (dirPath: string): void => {
        for (const entry of readdirSync(dirPath)) {
          const full = join(dirPath, entry)
          if (statSync(full).isDirectory()) {
            walk(full)
            continue
          }
          if (full.endsWith(`.ts`) === false) continue
          writeFileSync(full, readFileSync(full, `utf-8`).replaceAll(`~/core/ctx`, ctxAbs))
        }
      }
      walk(join(dir, `src`, `pages`))
      writeFileSync(join(dir, `gramstax.config.ts`), `export default {deploy: \`serverless\`, optionsDeploy: {adapter: \`cloudflare-mod\`, name: \`my-worker\`, url: \`https://my-worker.example.workers.dev/webhook\`}}\n`, `utf-8`)
      const code = await new GramstaxBuild().run([], dir)
      expect(code).toBe(0)
      const outDir = join(dir, `.gramstax`)
      for (const file of [`manifest.js`, `routes.json`, join(`gen`, `manifest.js`), join(`server`, `worker.js`), join(`server`, `wrangler.toml`), join(`server`, `bun-stub.ts`)]) {
        expect(existsSync(join(outDir, file))).toBe(true)
      }
      expect(existsSync(join(outDir, `server`, `lambda.js`))).toBe(false)
    } finally {
      rmSync(dir, {force: true, recursive: true})
    }
  }, 180000)

  it(`rebuild without adapter removes stale server entries`, async () => {
    const dir = makeTempDir()
    try {
      cpSync(join(import.meta.dir, `fixtures`, `manifest`, `pages`), join(dir, `src`, `pages`), {recursive: true})
      const ctxAbs = pathToFileURL(join(import.meta.dir, `..`, `src`, `core`, `ctx.ts`)).href
      const walk = (dirPath: string): void => {
        for (const entry of readdirSync(dirPath)) {
          const full = join(dirPath, entry)
          if (statSync(full).isDirectory()) {
            walk(full)
            continue
          }
          if (full.endsWith(`.ts`) === false) continue
          writeFileSync(full, readFileSync(full, `utf-8`).replaceAll(`~/core/ctx`, ctxAbs))
        }
      }
      walk(join(dir, `src`, `pages`))
      writeFileSync(join(dir, `gramstax.config.ts`), `export default {deploy: \`polling\`}\n`, `utf-8`)
      // Simulate a previous workers build: stale entries must not survive a
      // rebuild that no longer selects them (same-process config rewrite would
      // hit Bun's ESM import cache, so plant the stale files directly).
      const staleServer = join(dir, `.gramstax`, `server`)
      mkdirSync(staleServer, {recursive: true})
      writeFileSync(join(staleServer, `worker.js`), `// stale`, `utf-8`)
      writeFileSync(join(staleServer, `wrangler.toml`), `// stale`, `utf-8`)
      expect(await new GramstaxBuild().run([], dir)).toBe(0)
      const outDir = join(dir, `.gramstax`)
      expect(existsSync(join(outDir, `server`))).toBe(false)
      for (const file of [`manifest.js`, `routes.json`, join(`gen`, `manifest.js`)]) {
        expect(existsSync(join(outDir, file))).toBe(true)
      }
    } finally {
      rmSync(dir, {force: true, recursive: true})
    }
  }, 180000)
})
