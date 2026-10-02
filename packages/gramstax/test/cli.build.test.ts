import {describe, expect, it} from "bun:test"
import {cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {pathToFileURL} from "node:url"
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
      expect(capture.logs.join(`\n`)).toContain(`pages directory not found`)
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
      expect(printed).toContain(`optionsDeploy.serverless:  (default)`)
      expect(printed).toContain(`optionsDeploy.serverless.name:  (default)`)
      expect(printed).toContain(`optionsDeploy.serverless.url:  (default)`)
      expect(printed).toContain(`dry-run: no files written`)
      const order = [`gramstax build plan`, `pagesDir:`, `outDir:`, `targets:`, `deploy:`, `optionsDeploy.serverless:`, `optionsDeploy.serverless.name:`, `optionsDeploy.serverless.url:`, `dry-run: no files written`]
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
    writeFileSync(join(dir, `gramstax.config.ts`), `export default {deploy: \`serverless\`, optionsDeploy: {serverless: {"aws-lambda-async": {url: \`https://example.com/webhook\`, secretToken: \`test-secret\`}}}}\n`, `utf-8`)
    const capture = captureConsole()
    try {
      const code = await new GramstaxBuild().run([`--target`, `aws-lambda-async`, `--dry-run`], dir)
      expect(code).toBe(0)
      const joined = capture.logs.join(`\n`)
      expect(joined).toContain(`targets: aws-lambda-async`)
      expect(joined).toContain(`optionsDeploy.serverless.aws-lambda-async: aws-lambda-async (flag)`)
      expect(joined).toContain(`dry-run: no files written`)
      expect(existsSync(join(dir, `.gramstax`))).toBe(false)
    } finally {
      capture.restore()
      rmSync(dir, {force: true, recursive: true})
    }
  })

  it(`preserves the webhook-url fallback when --target is explicit`, async () => {
    const dir = makeTempDir()
    mkdirSync(join(dir, `src`, `pages`), {recursive: true})
    writeFileSync(join(dir, `gramstax.config.ts`), `export default {deploy: \`webhook\`, optionsDeploy: {webhook: {url: \`https://hook.example/hook\`, secretToken: \`s\`}}}\n`, `utf-8`)
    const capture = captureConsole()
    try {
      const code = await new GramstaxBuild().run([`--target`, `cloudflare-mod`, `--dry-run`], dir)
      expect(code).toBe(0)
      const joined = capture.logs.join(`\n`)
      expect(joined).toContain(`targets: cloudflare-mod`)
      expect(joined).toContain(`optionsDeploy.serverless.url: https://hook.example/hook (config)`)
      expect(joined).toContain(`optionsDeploy.serverless.cloudflare-mod: cloudflare-mod (flag)`)
    } finally {
      capture.restore()
      rmSync(dir, {force: true, recursive: true})
    }
  })

  it(`rejects the pre-036 target names`, async () => {
    for (const legacy of [`cloudflare-workers`, `lambda`]) {
      const dir = makeTempDir()
      try {
        mkdirSync(join(dir, `src`, `pages`), {recursive: true})
        await expect(new GramstaxBuild().run([`--target`, legacy], dir)).rejects.toThrow(/unknown target/)
      } finally {
        rmSync(dir, {force: true, recursive: true})
      }
    }
  })

  it(`--dry-run prints convention paths without config file or flags`, async () => {
    const dir = makeTempDir()
    mkdirSync(join(dir, `src`, `pages`), {recursive: true})
    const capture = captureConsole()
    try {
      const code = await new GramstaxBuild().run([`--dry-run`], dir)
      expect(code).toBe(0)
      const joined = capture.logs.join(`\n`)
      expect(joined).toContain(`pagesDir: src/pages`)
      expect(joined).toContain(`outDir: .gramstax`)
      expect(joined).toContain(`targets: `)
      expect(joined).toContain(`deploy: polling (default)`)
      expect(joined).toContain(`optionsDeploy.serverless:  (default)`)
      expect(joined).toContain(`optionsDeploy.serverless.name:  (default)`)
      expect(joined).toContain(`optionsDeploy.serverless.url:  (default)`)
      expect(joined).toContain(`dry-run: no files written`)
      expect(existsSync(join(dir, `.gramstax`))).toBe(false)
    } finally {
      capture.restore()
      rmSync(dir, {force: true, recursive: true})
    }
  })

  it(`--dry-run annotates config sources when gramstax.config.ts defines deploy keys`, async () => {
    const dir = makeTempDir()
    mkdirSync(join(dir, `src`, `pages`), {recursive: true})
    writeFileSync(join(dir, `gramstax.config.ts`), `export default {deploy: \`serverless\`, optionsDeploy: {serverless: {"cloudflare-mod": {name: \`cfg-worker\`, url: \`https://cfg-worker.example.workers.dev/webhook\`, secretToken: \`test-secret\`}}}}\n`, `utf-8`)
    const capture = captureConsole()
    try {
      const code = await new GramstaxBuild().run([`--dry-run`], dir)
      expect(code).toBe(0)
      const joined = capture.logs.join(`\n`)
      expect(joined).toContain(`pagesDir: src/pages`)
      expect(joined).toContain(`outDir: .gramstax`)
      expect(joined).toContain(`targets: cloudflare-mod`)
      expect(joined).toContain(`deploy: serverless (config)`)
      expect(joined).toContain(`optionsDeploy.serverless.cloudflare-mod: cloudflare-mod (config)`)
      expect(joined).toContain(`optionsDeploy.serverless.name: cfg-worker (config)`)
      expect(joined).toContain(`optionsDeploy.serverless.url: https://cfg-worker.example.workers.dev/webhook (config)`)
      expect(joined).toContain(`dry-run: no files written`)
      expect(existsSync(join(dir, `.gramstax`))).toBe(false)
    } finally {
      capture.restore()
      rmSync(dir, {force: true, recursive: true})
    }
  })

  it(`tells non-serverless deploys to use gramstax start instead`, async () => {
    const dir = makeTempDir()
    mkdirSync(join(dir, `src`, `pages`), {recursive: true})
    writeFileSync(join(dir, `gramstax.config.ts`), `export default {deploy: \`polling\`}\n`, `utf-8`)
    const capture = captureConsole()
    try {
      const code = await new GramstaxBuild().run([], dir)
      expect(code).toBe(0)
      const joined = capture.logs.join(`\n`)
      expect(joined).toContain(`only consumed by \`deploy: "serverless"\``)
      expect(joined).toContain(`gramstax start`)
      expect(joined).toContain(`deploy: "polling"`)
    } finally {
      capture.restore()
      rmSync(dir, {force: true, recursive: true})
    }
  })

  it(`states manifest boot when the deploy mode is serverless`, async () => {
    const dir = makeTempDir()
    mkdirSync(join(dir, `src`, `pages`), {recursive: true})
    writeFileSync(join(dir, `gramstax.config.ts`), `export default {deploy: \`serverless\`, optionsDeploy: {serverless: {"cloudflare-mod": {url: \`https://w.example.workers.dev/webhook\`, secretToken: \`test-secret\`}}}}\n`, `utf-8`)
    const capture = captureConsole()
    try {
      const code = await new GramstaxBuild().run([], dir)
      expect(code).toBe(0)
      const joined = capture.logs.join(`\n`)
      expect(joined).toContain(`consumed by \`deploy: "serverless"\` via manifest boot`)
      expect(joined).not.toContain(`gramstax start`)
    } finally {
      capture.restore()
      rmSync(dir, {force: true, recursive: true})
    }
  })

  it(`does not bake a log config that writes to disk`, async () => {
    const dir = makeTempDir()
    mkdirSync(join(dir, `src`, `pages`), {recursive: true})
    writeFileSync(join(dir, `gramstax.config.ts`), `export default {deploy: \`serverless\`, optionsDeploy: {serverless: {"cloudflare-mod": {url: \`https://w.example.workers.dev/webhook\`, secretToken: \`test-secret\`}}}, log: {force: \`file\`}}\n`, `utf-8`)
    const capture = captureConsole()
    try {
      const code = await new GramstaxBuild().run([`--dry-run`], dir)
      expect(code).toBe(0)
      const joined = capture.logs.join(`\n`)
      expect(joined).toContain(`writes to disk`)
    } finally {
      capture.restore()
      rmSync(dir, {force: true, recursive: true})
    }
  })

  it(`bakes a log config that only writes to console`, () => {
    const edgeSafe = (config: unknown): Record<string, unknown> => new GramstaxBuild()._edgeSafeParams(config as never)
    expect(edgeSafe({log: {force: `console`, formatTime: `iso`}}).log).toEqual({force: `console`, formatTime: `iso`})
    expect(edgeSafe({log: true}).log).toBe(true)
    expect(edgeSafe({log: false}).log).toBe(false)
    expect(edgeSafe({log: {force: `all`}}).log).toBeUndefined()
    expect(edgeSafe({log: {pathFile: `./x.log`}}).log).toBeUndefined()
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
      writeFileSync(join(dir, `gramstax.config.ts`), `export default {deploy: \`serverless\`, optionsDeploy: {serverless: {"cloudflare-mod": {name: \`my-worker\`, url: \`https://my-worker.example.workers.dev/webhook\`, secretToken: \`test-secret\`}}}}\n`, `utf-8`)
      const config = await new GramstaxConfigLoader().loadConfig(dir)
      expect(config.deploy).toBe(`serverless`)
      const section = (config.optionsDeploy?.serverless as {"cloudflare-mod": {name?: string; url: string}} | undefined)?.["cloudflare-mod"]
      expect(section?.name).toBe(`my-worker`)
      expect(section?.url).toBe(`https://my-worker.example.workers.dev/webhook`)
    } finally {
      rmSync(dir, {force: true, recursive: true})
    }
  })

  it(`loadConfig rejects unknown adapter naming valid adapters`, async () => {
    const dir = makeTempDir()
    try {
      writeFileSync(join(dir, `gramstax.config.ts`), `export default {deploy: \`serverless\`, optionsDeploy: {serverless: {"unknown-adapter": {url: \`https://example.com/webhook\`, secretToken: \`test-secret\`}}}}\n`, `utf-8`)
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
      {file: `export default {deploy: \`serverless\`, optionsDeploy: {serverless: {42: {url: \`https://w.example/x\`, secretToken: \`test-secret\`}}}}\n`, field: `adapter`},
      {file: `export default {deploy: \`serverless\`, optionsDeploy: {serverless: {nope: {url: \`https://w.example/x\`, secretToken: \`test-secret\`}}}}\n`, field: `cloudflare-mod`},
      {file: `export default {deploy: \`serverless\`, optionsDeploy: {serverless: {"cloudflare-mod": {name: 42, url: \`https://w.example/x\`, secretToken: \`test-secret\`}}}}\n`, field: `name`},
      {file: `export default {deploy: \`serverless\`, optionsDeploy: {serverless: {"cloudflare-mod": {name: \`w\`, url: 42, secretToken: \`test-secret\`}}}}\n`, field: `url`},
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

  it(`loadConfig rejects nested branch violations with actionable errors`, async () => {
    const cases: Array<{file: string; field: string}> = [
      {file: `export default {deploy: \`webhook\`, optionsDeploy: {webhook: {url: \`https://example.com/hook\`}}}\n`, field: `secretToken`},
      {file: `export default {deploy: \`webhook\`, optionsDeploy: {webhook: {url: \`https://example.com/hook\`, secretToken: \`\`}}}\n`, field: `secretToken`},
      {file: `export default {deploy: \`webhook\`, optionsDeploy: {webhook: {url: \`https://example.com/hook\`, secretToken: \`with space!\`}}}\n`, field: `must match`},
      {file: `export default {deploy: \`polling\`, optionsDeploy: {webhook: {url: \`https://example.com/hook\`, secretToken: \`s\`}}}\n`, field: `does not match`},
      {file: `export default {deploy: \`webhook\`, optionsDeploy: {webhook: {url: \`https://example.com/hook\`, secretToken: \`s\`}, polling: {maxRetries: 3}}}\n`, field: `at most one`},
      {file: `export default {optionsDeploy: {bogus: {}}}\n`, field: `bogus`},
      {file: `export default {deploy: \`serverless\`, optionsDeploy: {serverless: {url: \`https://example.com/webhook\`, secretToken: \`test-secret\`}}}\n`, field: `unknown adapter key`},
      {file: `export default {deploy: \`serverless\`, optionsDeploy: {serverless: {"cloudflare-mod": {secretToken: \`test-secret\`}}}}\n`, field: `is required`},
      {file: `export default {deploy: \`webhook\`, optionsDeploy: {webhook: {secretToken: \`s\`}}}\n`, field: `is required`},
      {file: `export default {deploy: \`polling\`, optionsDeploy: {polling: {maxRetries: -2}}}\n`, field: `maxRetries`},
      {file: `export default {deploy: \`raw\`, optionsDeploy: {polling: {maxRetries: 1}}}\n`, field: `does not match`},
      {file: `export default {deploy: \`test\`, optionsDeploy: {webhook: {url: \`https://example.com/hook\`, secretToken: \`s\`}}}\n`, field: `does not match`}
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

  it(`loadConfig accepts nested polling maxRetries and empty raw/test branches`, async () => {
    for (const body of [`export default {deploy: \`polling\`, optionsDeploy: {polling: {maxRetries: 3}}}\n`, `export default {deploy: \`raw\`, optionsDeploy: {raw: {}}}\n`, `export default {deploy: \`test\`, optionsDeploy: {test: {}}}\n`]) {
      const dir = makeTempDir()
      try {
        writeFileSync(join(dir, `gramstax.config.ts`), body, `utf-8`)
        const config = await new GramstaxConfigLoader().loadConfig(dir)
        expect(config.deploy).toBeDefined()
      } finally {
        rmSync(dir, {force: true, recursive: true})
      }
    }
    const dir = makeTempDir()
    try {
      writeFileSync(join(dir, `gramstax.config.ts`), `export default {deploy: \`polling\`, optionsDeploy: {polling: {maxRetries: 3}}}\n`, `utf-8`)
      const config = await new GramstaxConfigLoader().loadConfig(dir)
      expect(config.optionsDeploy?.polling?.maxRetries).toBe(3)
    } finally {
      rmSync(dir, {force: true, recursive: true})
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
      writeFileSync(join(dir, `gramstax.config.ts`), `export default {deploy: \`serverless\`, optionsDeploy: {serverless: {"cloudflare-mod": {name: \`my-worker\`, url: \`https://my-worker.example.workers.dev/webhook\`, secretToken: \`test-secret\`}}}}\n`, `utf-8`)
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
