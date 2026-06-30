import {join} from "node:path"
import {BotCore} from "../src/core/bot.js"
import {TemplateManager} from "gramstax"

const templateManager = new TemplateManager({path: [join(import.meta.dir, `../src/pages`)]})
export const bot = new BotCore({
  deploy: `test`,
  token: `test`,
  log: false,
  templateManager
})

export const e2e = bot.e2e
