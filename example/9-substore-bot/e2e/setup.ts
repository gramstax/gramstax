import {join} from "node:path"
import {TemplateManager} from "gramstax"
import {BotCore} from "../src/core/bot"

export type {ITE2eApiCall, ITE2eUpdateOptions} from "gramstax"

export const bot = new BotCore({
  deploy: `test`,
  token: `test`,
  log: false,
  templateManager: new TemplateManager({
    path: [join(import.meta.dir, `../src/pages`)]
  })
})
export const e2e = bot.e2e!
export const enUser = {user: {id: 4001, language_code: `en`}, chat: {id: 4001}}
export const idUser = {user: {id: 5001, language_code: `id`}, chat: {id: 5001}}
// Dedicated users for the checkout flow tests: their free-text session
// (contact input) would otherwise hijack `/start` from other test files
// running in parallel on the shared enUser/idUser.
export const flowUser = {user: {id: 4101, language_code: `en`}, chat: {id: 4101}}
export const flowUserId = {user: {id: 5101, language_code: `id`}, chat: {id: 5101}}
export async function resetEnv() {
  e2e.clearCalls()
  await bot.cacheState.clear()
}
