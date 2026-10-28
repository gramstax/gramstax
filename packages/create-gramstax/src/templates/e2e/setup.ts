import {join} from "node:path"
import {TemplateManager} from "gramstax"
import {BotCore} from "../src/core/bot"

export type {IE2eApiCall, IE2eUpdateOptions} from "gramstax"

export const bot = new BotCore({
  deploy: `test`,
  token: `test`,
  log: false,
  autoRetry: true,
  templateManager: new TemplateManager({
    path: [join(import.meta.dir, `../src/pages`)]
  })
})
export const e2e = bot.e2e!

// Same fixture ids as example/*/e2e/setup.ts. username is required by the
// template user guard; chat is omitted (sessions are keyed by user id).
export const enUser = {user: {id: 4001, username: `testuser`, language_code: `en`}}
export const idUser = {user: {id: 5001, username: `pengguna`, language_code: `id`}}
