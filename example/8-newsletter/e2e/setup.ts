import {join} from "node:path"
import {CacheExternal, TemplateManager} from "gramstax"
import {BotCore} from "../src/core/bot"

export type {IE2eApiCall, IE2eUpdateOptions} from "gramstax"

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
export const enUser = {user: {id: 4001, language_code: `en`}, chat: {id: 4001}}
export const idUser = {user: {id: 5001, language_code: `id`}, chat: {id: 5001}}
export async function resetEnv() {
  e2e.clearCalls()
  await bot.cacheSession.clear()
}
