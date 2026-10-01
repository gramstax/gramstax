import {describe, expect, it} from "bun:test"
import {mkdtempSync, rmSync, writeFileSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {Bot} from "grammy"
import {GramstaxConfigLoader} from "~/cli/config"
import {Gramstax} from "~/core/bot"
import {TemplateManager} from "~/template/manager"

const URL = `https://example.com/webhook`

function tm(dir: string): TemplateManager {
  return new TemplateManager({path: [dir]})
}

describe(`serverless secretToken require rules`, () => {
  it(`loader rejects serverless without secretToken`, async () => {
    const dir = mkdtempSync(join(tmpdir(), `serverless-secret-`))
    try {
      writeFileSync(join(dir, `gramstax.config.ts`), `export default {deploy: \`serverless\`, optionsDeploy: {serverless: {adapter: \`cloudflare-mod\`, url: \`https://example.com/webhook\`}}}\n`, `utf-8`)
      let message = ``
      try {
        await new GramstaxConfigLoader().loadConfig(dir)
      } catch (error: unknown) {
        message = error instanceof Error ? error.message : String(error)
      }
      const file = join(dir, `gramstax.config.ts`)
      expect(message).toBe(`Invalid gramstax config at ${file}: \`optionsDeploy.serverless.secretToken\` is required when \`deploy\` is \`serverless\` (fix: generate via \`openssl rand -hex 32\`)`)
    } finally {
      rmSync(dir, {force: true, recursive: true})
    }
  })

  it(`loader rejects serverless with empty secretToken`, async () => {
    const dir = mkdtempSync(join(tmpdir(), `serverless-secret-`))
    try {
      writeFileSync(join(dir, `gramstax.config.ts`), `export default {deploy: \`serverless\`, optionsDeploy: {serverless: {adapter: \`cloudflare-mod\`, url: \`https://example.com/webhook\`, secretToken: \`\`}}}\n`, `utf-8`)
      let message = ``
      try {
        await new GramstaxConfigLoader().loadConfig(dir)
      } catch (error: unknown) {
        message = error instanceof Error ? error.message : String(error)
      }
      const file = join(dir, `gramstax.config.ts`)
      expect(message).toBe(`Invalid gramstax config at ${file}: \`optionsDeploy.serverless.secretToken\` is required when \`deploy\` is \`serverless\` (fix: generate via \`openssl rand -hex 32\`)`)
    } finally {
      rmSync(dir, {force: true, recursive: true})
    }
  })

  it(`loader rejects serverless with malformed secretToken`, async () => {
    const dir = mkdtempSync(join(tmpdir(), `serverless-secret-`))
    try {
      writeFileSync(join(dir, `gramstax.config.ts`), `export default {deploy: \`serverless\`, optionsDeploy: {serverless: {adapter: \`cloudflare-mod\`, url: \`https://example.com/webhook\`, secretToken: \`with space!\`}}}\n`, `utf-8`)
      let message = ``
      try {
        await new GramstaxConfigLoader().loadConfig(dir)
      } catch (error: unknown) {
        message = error instanceof Error ? error.message : String(error)
      }
      const file = join(dir, `gramstax.config.ts`)
      expect(message).toBe(`Invalid gramstax config at ${file}: \`optionsDeploy.serverless.secretToken\` must match ^[A-Za-z0-9_-]{1,256}$ (got \`with space!\`) (fix: generate via \`openssl rand -hex 32\`)`)
    } finally {
      rmSync(dir, {force: true, recursive: true})
    }
  })

  it(`loader rejects serverless with overlong secretToken`, () => {
    const long = `a`.repeat(257)
    let message = ``
    try {
      new GramstaxConfigLoader()._validateConfig(`probe`, {deploy: `serverless`, optionsDeploy: {serverless: {adapter: `cloudflare-mod`, url: `https://example.com/webhook`, secretToken: long}}})
    } catch (error: unknown) {
      message = error instanceof Error ? error.message : String(error)
    }
    expect(message).toBe(`Invalid gramstax config at probe: \`optionsDeploy.serverless.secretToken\` must match ^[A-Za-z0-9_-]{1,256}$ (got \`${long}\`) (fix: generate via \`openssl rand -hex 32\`)`)
  })

  it(`constructor throws for serverless without secret`, () => {
    const dir = mkdtempSync(join(tmpdir(), `serverless-secret-`))
    try {
      expect(() => new Gramstax({token: `test`, deploy: `serverless`, optionsDeploy: {serverless: {adapter: `cloudflare-mod`, url: `https://example.com/webhook`}}, templateManager: tm(dir), log: false} as never)).toThrow(
        `Params deploy serverless requires optionsDeploy.serverless.secretToken to be a non-empty string matching ^[A-Za-z0-9_-]{1,256}$ (generate one with: openssl rand -hex 32)`
      )
    } finally {
      rmSync(dir, {force: true, recursive: true})
    }
  })

  it(`_runServerless prefers branch secret over env`, async () => {
    const dir = mkdtempSync(join(tmpdir(), `serverless-secret-`))
    const bot = new Gramstax({token: `test`, deploy: `test`, templateManager: tm(dir), log: false})
    await bot.ready
    const seen: Array<{url: string; extra?: unknown}> = []
    const realBot = new Bot(`test`) as unknown as Record<string, unknown>
    Object.defineProperty(realBot, `api`, {
      value: {
        getMe: async () => ({id: 1, is_bot: true, first_name: `Test`, username: `test`}),
        getWebhookInfo: async () => ({url: ``}),
        setWebhook: async (url: string, extra?: unknown) => {
          seen.push({extra, url})
          return true
        }
      },
      writable: true
    })
    bot.bot = realBot as never
    const previous = process.env.BOT_WEBHOOK_SECRET
    process.env.BOT_WEBHOOK_SECRET = `env-secret`
    try {
      await (bot as unknown as {_runServerless: (adapter: string, url?: string, secret?: string) => Promise<void>})._runServerless(`cloudflare-mod`, URL, `branch-secret`)
    } finally {
      if (previous === undefined) {
        delete process.env.BOT_WEBHOOK_SECRET
      } else {
        process.env.BOT_WEBHOOK_SECRET = previous
      }
    }
    expect(seen).toEqual([{extra: {secret_token: `branch-secret`}, url: URL}])
    await bot.stop()
    rmSync(dir, {force: true, recursive: true})
  })
})
