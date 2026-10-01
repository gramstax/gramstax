import {afterEach, beforeEach, describe, expect, it} from "bun:test"
import {mkdtempSync, rmSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {Gramstax} from "~/core/bot"
import {TemplateManager} from "~/template/manager"
import type {IGramstaxOptionsDeploy} from "~/types/config"

const URL = `http://127.0.0.1:18787/webhook`

let dir: string

function createBot(deploy: `polling` | `webhook` | `serverless` | `raw` | `test`, optionsDeploy?: IGramstaxOptionsDeploy) {
  return new Gramstax({token: `test`, deploy, optionsDeploy, templateManager: new TemplateManager({path: [dir]}), log: false})
}

type RunFn = (adapter: string, url?: string) => Promise<void>

function spyApi(bot: Gramstax) {
  const seen: Array<string> = []
  const api = bot.bot.api as unknown as {setWebhook: (url: string, extra?: unknown) => Promise<unknown>; getWebhookInfo: () => Promise<unknown>}
  const origSet = api.setWebhook.bind(api)
  api.setWebhook = (async (url: string, extra?: unknown) => {
    seen.push(url)
    return origSet(url, extra)
  }) as typeof api.setWebhook
  return {seen, api}
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), `serverless-hook-`))
})

afterEach(() => {
  rmSync(dir, {recursive: true, force: true})
})

describe(`serverless public URL`, () => {
  it(`registers the public URL from optionsDeploy`, async () => {
    const bot = createBot(`test`)
    const {seen} = spyApi(bot)
    await (bot as unknown as {_runServerless: RunFn})._runServerless(`cloudflare-mod`, URL)
    expect(seen).toEqual([URL])
  })

  it(`skips registration when the URL is already set`, async () => {
    const bot = createBot(`test`)
    const {seen, api} = spyApi(bot)
    api.getWebhookInfo = (async () => ({url: URL})) as typeof api.getWebhookInfo
    await (bot as unknown as {_runServerless: RunFn})._runServerless(`cloudflare-mod`, URL)
    expect(seen).toEqual([])
  })

  it(`throws at construction without optionsDeploy.url`, () => {
    expect(() => createBot(`serverless`, {serverless: {adapter: `cloudflare-mod`, secretToken: `test-secret`}})).toThrow(/url/)
  })

  it(`throws on placeholder url at construction`, () => {
    expect(() => createBot(`serverless`, {serverless: {adapter: `cloudflare-mod`, url: `https://example.com/not-a-url`.replace(`https://`, ``), secretToken: `test-secret`}})).toThrow(/url/)
  })

  it(`throws on unknown adapter at construction`, () => {
    expect(() => createBot(`serverless`, {serverless: {adapter: `std/http`, url: URL, secretToken: `test-secret`}})).toThrow(/cloudflare-mod/)
  })

  it(`throws on legacy colon deploy naming the new form`, () => {
    expect(() => new Gramstax({token: `test`, deploy: `serverless:cloudflare-mod:${URL}`, templateManager: new TemplateManager({path: [dir]}), log: false} as never)).toThrow(/optionsDeploy/)
  })
})
