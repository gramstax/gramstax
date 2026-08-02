import {join} from "node:path"
import {TemplateManager} from "gramstax"
import {BotCore} from "../src/core/bot"

export type {ITE2eApiCall, ITE2eUpdateOptions} from "gramstax"

const templateManager = new TemplateManager({
  path: [join(import.meta.dir, `../src/pages`)]
})
export const bot = new BotCore({
  deploy: `test`,
  token: `test`,
  log: false,
  templateManager
})

export const e2e = bot.e2e!
