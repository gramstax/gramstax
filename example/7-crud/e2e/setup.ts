import {join} from "node:path"
import {BotCore} from "../src/core/bot"
import {TemplateManager} from "gramstax"
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
export async function resetDb(userId: number) {
  await bot.db.init()
  await bot.db.items.purge(userId)
}
