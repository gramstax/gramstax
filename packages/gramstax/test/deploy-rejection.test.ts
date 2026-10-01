import {describe, expect, it} from "bun:test"
import {mkdtempSync, rmSync, writeFileSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {GramstaxBuild} from "~/cli/build"
import {GramstaxStart} from "~/cli/start"
import {Gramstax} from "~/core/bot"
import {TemplateManager} from "~/template/manager"

function tm(dir: string): TemplateManager {
  return new TemplateManager({path: [dir]})
}

describe(`deploy structured rejection battery`, () => {
  it(`legacy 3-part string throws naming the new form`, () => {
    const dir = mkdtempSync(join(tmpdir(), `deploy-rej-`))
    try {
      expect(() => new Gramstax({token: `test`, deploy: `serverless:cloudflare-mod:https://example.com/webhook`, templateManager: tm(dir), log: false} as never)).toThrow(/optionsDeploy/)
    } finally {
      rmSync(dir, {force: true, recursive: true})
    }
  })

  it(`unknown adapter throws naming known adapters`, () => {
    const dir = mkdtempSync(join(tmpdir(), `deploy-rej-`))
    try {
      expect(() => new Gramstax({token: `test`, deploy: `serverless`, optionsDeploy: {serverless: {nope: {url: `https://example.com/webhook`, secretToken: `test-secret`}}}, templateManager: tm(dir), log: false} as never)).toThrow(/cloudflare-mod/)
    } finally {
      rmSync(dir, {force: true, recursive: true})
    }
  })

  it(`non-empty optionsDeploy with polling throws`, () => {
    const dir = mkdtempSync(join(tmpdir(), `deploy-rej-`))
    try {
      expect(() => new Gramstax({token: `test`, deploy: `polling`, optionsDeploy: {webhook: {url: `https://example.com/hook`, secretToken: `s`}}, templateManager: tm(dir), log: false} as never)).toThrow(/optionsDeploy/)
    } finally {
      rmSync(dir, {force: true, recursive: true})
    }
  })

  it(`missing url for serverless throws`, () => {
    const dir = mkdtempSync(join(tmpdir(), `deploy-rej-`))
    try {
      expect(() => new Gramstax({token: `test`, deploy: `serverless`, optionsDeploy: {serverless: {"cloudflare-mod": {secretToken: `test-secret`}}}, templateManager: tm(dir), log: false} as never)).toThrow(/url/)
    } finally {
      rmSync(dir, {force: true, recursive: true})
    }
  })

  it(`placeholder url for serverless throws`, () => {
    const dir = mkdtempSync(join(tmpdir(), `deploy-rej-`))
    try {
      expect(() => new Gramstax({token: `test`, deploy: `serverless`, optionsDeploy: {serverless: {"cloudflare-mod": {url: `https://<your-worker>.workers.dev/webhook`, secretToken: `test-secret`}}}, templateManager: tm(dir), log: false} as never)).toThrow(/url/)
    } finally {
      rmSync(dir, {force: true, recursive: true})
    }
  })

  it(`webhook with adapter set throws`, async () => {
    const dir = mkdtempSync(join(tmpdir(), `deploy-rej-`))
    try {
      writeFileSync(join(dir, `gramstax.config.ts`), `export default {deploy: \`webhook\`, optionsDeploy: {webhook: {url: \`https://example.com/hook\`, secretToken: \`s\`, adapter: \`cloudflare-mod\`}}}\n`, `utf-8`)
      const {GramstaxConfigLoader} = await import(`~/cli/config`)
      let message = ``
      try {
        await new GramstaxConfigLoader().loadConfig(dir)
      } catch (error: unknown) {
        message = error instanceof Error ? error.message : String(error)
      }
      expect(message).toContain(`adapter`)
    } finally {
      rmSync(dir, {force: true, recursive: true})
    }
  })

  it(`config loader rejects unknown adapter key naming both valid adapters`, async () => {
    const dir = mkdtempSync(join(tmpdir(), `deploy-rej-`))
    try {
      writeFileSync(join(dir, `gramstax.config.ts`), `export default {deploy: \`serverless\`, optionsDeploy: {serverless: {nope: {url: \`https://example.com/webhook\`, secretToken: \`test-secret\`}}}}\n`, `utf-8`)
      const {GramstaxConfigLoader} = await import(`~/cli/config`)
      let message = ``
      try {
        await new GramstaxConfigLoader().loadConfig(dir)
      } catch (error: unknown) {
        message = error instanceof Error ? error.message : String(error)
      }
      const file = join(dir, `gramstax.config.ts`)
      expect(message).toBe(`Invalid gramstax config at ${file}: \`optionsDeploy.serverless\` has unknown adapter key \`nope\` (supported: \`cloudflare-mod\`, \`aws-lambda-async\`)`)
    } finally {
      rmSync(dir, {force: true, recursive: true})
    }
  })

  it(`config loader rejects two adapter keys at once`, async () => {
    const dir = mkdtempSync(join(tmpdir(), `deploy-rej-`))
    try {
      writeFileSync(
        join(dir, `gramstax.config.ts`),
        `export default {deploy: \`serverless\`, optionsDeploy: {serverless: {'cloudflare-mod': {url: \`https://example.com/webhook\`, secretToken: \`test-secret\`}, 'aws-lambda-async': {url: \`https://example.com/webhook\`, secretToken: \`test-secret\`}}}}\n`,
        `utf-8`
      )
      const {GramstaxConfigLoader} = await import(`~/cli/config`)
      let message = ``
      try {
        await new GramstaxConfigLoader().loadConfig(dir)
      } catch (error: unknown) {
        message = error instanceof Error ? error.message : String(error)
      }
      const file = join(dir, `gramstax.config.ts`)
      expect(message).toBe(`Invalid gramstax config at ${file}: \`optionsDeploy.serverless\` must define exactly one adapter key (got \`aws-lambda-async\`, \`cloudflare-mod\`)`)
    } finally {
      rmSync(dir, {force: true, recursive: true})
    }
  })

  it(`config loader rejects name-only cloudflare section naming url`, async () => {
    const dir = mkdtempSync(join(tmpdir(), `deploy-rej-`))
    try {
      writeFileSync(join(dir, `gramstax.config.ts`), `export default {deploy: \`serverless\`, optionsDeploy: {serverless: {'cloudflare-mod': {name: \`gramstax-worker\`}}}}\n`, `utf-8`)
      const {GramstaxConfigLoader} = await import(`~/cli/config`)
      let message = ``
      try {
        await new GramstaxConfigLoader().loadConfig(dir)
      } catch (error: unknown) {
        message = error instanceof Error ? error.message : String(error)
      }
      const file = join(dir, `gramstax.config.ts`)
      expect(message).toBe(`Invalid gramstax config at ${file}: \`optionsDeploy.serverless['cloudflare-mod'].url\` is required when \`deploy\` is \`serverless\` (fix: set \`optionsDeploy: {serverless: {'cloudflare-mod': {url: \`https://example.com/webhook\`, secretToken: \`<32+ chars>\`}}}\`)`)
    } finally {
      rmSync(dir, {force: true, recursive: true})
    }
  })

  it(`config loader rejects a cloudflare-only field on the lambda section`, async () => {
    const dir = mkdtempSync(join(tmpdir(), `deploy-rej-`))
    try {
      writeFileSync(join(dir, `gramstax.config.ts`), `export default {deploy: \`serverless\`, optionsDeploy: {serverless: {'aws-lambda-async': {url: \`https://example.com/webhook\`, secretToken: \`test-secret\`, compatibilityDate: \`2026-01-01\`}}}}\n`, `utf-8`)
      const {GramstaxConfigLoader} = await import(`~/cli/config`)
      let message = ``
      try {
        await new GramstaxConfigLoader().loadConfig(dir)
      } catch (error: unknown) {
        message = error instanceof Error ? error.message : String(error)
      }
      const file = join(dir, `gramstax.config.ts`)
      expect(message).toBe(`Invalid gramstax config at ${file}: unknown field \`compatibilityDate\` in \`optionsDeploy.serverless['aws-lambda-async']\` (supported: \`url\`, \`secretToken\`)`)
    } finally {
      rmSync(dir, {force: true, recursive: true})
    }
  })

  it(`--target overrides the configured adapter and warns`, async () => {
    const dir = mkdtempSync(join(tmpdir(), `deploy-rej-`))
    try {
      writeFileSync(join(dir, `gramstax.config.ts`), `export default {deploy: \`serverless\`, optionsDeploy: {serverless: {"aws-lambda-async": {url: \`https://example.com/webhook\`, secretToken: \`test-secret\`}}}}\n`, `utf-8`)
      const {mkdirSync} = await import(`node:fs`)
      mkdirSync(join(dir, `src`, `pages`), {recursive: true})
      const logs: Array<string> = []
      const original = console.log
      console.log = (...parts: Array<unknown>) => {
        logs.push(parts.map((part) => String(part)).join(` `))
      }
      try {
        await new GramstaxBuild().run([`--target`, `cloudflare-mod`, `--dry-run`], dir)
      } finally {
        console.log = original
      }
      const joined = logs.join(`\n`)
      expect(joined).toContain(`targets: cloudflare-mod`)
      expect(joined).toContain(`--target cloudflare-mod`)
      expect(joined).toContain(`aws-lambda-async`)
    } finally {
      rmSync(dir, {force: true, recursive: true})
    }
  })

  it(`--deploy with colon throws naming the new form`, () => {
    expect(() => new GramstaxStart()._parseArgv([`--deploy`, `webhook:https://example.com/hook`])).toThrow(/:/)
  })
})
