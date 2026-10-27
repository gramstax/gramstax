import {afterEach, describe, expect, it} from "bun:test"
import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from "node:fs"
import {basename, join} from "node:path"
import {GramstaxBuild} from "~/cli/build"
import {loadProjectEnv, projectEnvFiles} from "~/cli/env"
import {GramstaxStart} from "~/cli/start"

const ENV_PREFIX = `GRAMSTAX_ENV_`

function clearEnv(): void {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith(ENV_PREFIX)) delete process.env[key]
  }
}

function makeDir(): string {
  return mkdtempSync(join(import.meta.dir, `tmp-env-`))
}

function writeBotProject(dir: string): void {
  mkdirSync(join(dir, `src`, `core`), {recursive: true})
  mkdirSync(join(dir, `src`, `pages`), {recursive: true})
  writeFileSync(join(dir, `src`, `core`, `bot.ts`), [`import {Gramstax} from "~/core/bot"`, ``, `export class BotCore extends Gramstax {`, `}`].join(`\n`), `utf-8`)
}

afterEach(clearEnv)

describe(`project env files`, () => {
  it(`lists Next-style files from highest to lowest precedence`, () => {
    const dir = makeDir()
    try {
      expect(projectEnvFiles(dir, `development`).map((file) => basename(file))).toEqual([`.env.development.local`, `.env.local`, `.env.development`, `.env`])
      expect(projectEnvFiles(dir, `test`).map((file) => basename(file))).toEqual([`.env.test.local`, `.env.test`, `.env`])
    } finally {
      rmSync(dir, {recursive: true, force: true})
    }
  })
})

describe(`loadProjectEnv`, () => {
  it(`loads the highest-precedence value and returns only existing files`, () => {
    const dir = makeDir()
    try {
      writeFileSync(join(dir, `.env`), `GRAMSTAX_ENV_A=base\nGRAMSTAX_ENV_B=base\n`, `utf-8`)
      writeFileSync(join(dir, `.env.local`), `GRAMSTAX_ENV_A=local\nGRAMSTAX_ENV_C=local\n`, `utf-8`)
      writeFileSync(join(dir, `.env.development`), `GRAMSTAX_ENV_A=development\nGRAMSTAX_ENV_D=development\n`, `utf-8`)
      writeFileSync(join(dir, `.env.development.local`), `GRAMSTAX_ENV_A=development-local\n`, `utf-8`)

      const loaded = loadProjectEnv(dir, `development`)

      expect(process.env.GRAMSTAX_ENV_A).toBe(`development-local`)
      expect(process.env.GRAMSTAX_ENV_B).toBe(`base`)
      expect(process.env.GRAMSTAX_ENV_C).toBe(`local`)
      expect(process.env.GRAMSTAX_ENV_D).toBe(`development`)
      expect(loaded.map((file) => basename(file))).toEqual([`.env.development.local`, `.env.local`, `.env.development`, `.env`])
    } finally {
      rmSync(dir, {recursive: true, force: true})
    }
  })

  it(`does not overwrite an existing shell value`, () => {
    const dir = makeDir()
    try {
      process.env.GRAMSTAX_ENV_SHELL = `from-shell`
      writeFileSync(join(dir, `.env`), `GRAMSTAX_ENV_SHELL=from-file\n`, `utf-8`)

      loadProjectEnv(dir, `development`)

      expect(process.env.GRAMSTAX_ENV_SHELL).toBe(`from-shell`)
    } finally {
      rmSync(dir, {recursive: true, force: true})
    }
  })

  it(`skips .env.local in test mode but still loads .env.test`, () => {
    const dir = makeDir()
    try {
      writeFileSync(join(dir, `.env`), `GRAMSTAX_ENV_TEST=base\n`, `utf-8`)
      writeFileSync(join(dir, `.env.local`), `GRAMSTAX_ENV_TEST=local\n`, `utf-8`)
      writeFileSync(join(dir, `.env.test`), `GRAMSTAX_ENV_TEST=test\n`, `utf-8`)

      loadProjectEnv(dir, `test`)

      expect(process.env.GRAMSTAX_ENV_TEST).toBe(`test`)
    } finally {
      rmSync(dir, {recursive: true, force: true})
    }
  })

  it(`is a no-op when no env files exist`, () => {
    const dir = makeDir()
    try {
      expect(loadProjectEnv(dir, `development`)).toEqual([])
    } finally {
      rmSync(dir, {recursive: true, force: true})
    }
  })
})

describe(`CLI env integration`, () => {
  it(`start sees .env before gramstax.config.ts is imported`, async () => {
    const dir = makeDir()
    try {
      writeBotProject(dir)
      writeFileSync(join(dir, `.env`), `GRAMSTAX_ENV_TOKEN=file-token\n`, `utf-8`)
      writeFileSync(join(dir, `gramstax.config.ts`), `export default {token: process.env.GRAMSTAX_ENV_TOKEN, deploy: \`test\`}\n`, `utf-8`)
      delete process.env.GRAMSTAX_ENV_TOKEN

      const bot = await new GramstaxStart().boot([], dir)
      expect(bot.deployType).toBe(`test`)
      await bot.stop()
    } finally {
      rmSync(dir, {recursive: true, force: true})
    }
  })

  it(`build --dry-run sees .env before config import`, async () => {
    const dir = makeDir()
    const logs: string[] = []
    const originalLog = console.log
    console.log = (...args: unknown[]): void => {
      logs.push(args.map((arg) => String(arg)).join(` `))
    }
    try {
      mkdirSync(join(dir, `src`, `pages`), {recursive: true})
      writeFileSync(join(dir, `.env`), [`GRAMSTAX_ENV_DEPLOY=webhook`, `GRAMSTAX_ENV_URL=https://example.com/hook`, `GRAMSTAX_ENV_SECRET=test-secret`].join(`\n`), `utf-8`)
      writeFileSync(
        join(dir, `gramstax.config.ts`),
        [
          `const deploy = process.env.GRAMSTAX_ENV_DEPLOY`,
          `const base = {token: process.env.GRAMSTAX_ENV_TOKEN, deploy}`,
          `export default deploy === \`webhook\` ? {...base, optionsDeploy: {webhook: {url: process.env.GRAMSTAX_ENV_URL, secretToken: process.env.GRAMSTAX_ENV_SECRET}}} : base`,
          ``
        ].join(`\n`),
        `utf-8`
      )

      const code = await new GramstaxBuild().run([`--dry-run`], dir)

      expect(code).toBe(0)
      expect(logs.join(`\n`)).toContain(`deploy: webhook (config)`)
      expect(logs.join(`\n`)).toContain(`https://example.com/hook`)
    } finally {
      console.log = originalLog
      rmSync(dir, {recursive: true, force: true})
    }
  })
})
