import {join} from "node:path"
import {BotCore} from "../src/core/bot"
import {TemplateManager, CacheExternal} from "gramstax"
export type {ITE2eApiCall, ITE2eUpdateOptions} from "gramstax"

export const ADMIN_USER = {id: 840754970, first_name: `Admin`, username: `adminuser`, language_code: `en`}
export const ADMIN_CHAT = {id: 840754970, type: `private` as const, first_name: `Admin`}

export const bot = new BotCore({
  deploy: `test`,
  token: `test`,
  log: false,
  templateManager: new TemplateManager({
    path: [join(import.meta.dir, `../src/pages`)]
  }),
  cacheSession: new CacheExternal(`memory`)
})

export const e2e = bot.e2e!
export async function resetEnv() {
  e2e.clearCalls()
  await bot.cacheSession.clear()
}
