import {join} from "node:path"
import {BotCore} from "../src/core/bot"
import {TemplateManager} from "gramstax"

export type {ITE2eApiCall, ITE2eUpdateOptions} from "gramstax"

const origDir = process.cwd()
process.chdir(join(import.meta.dir, `..`))

const templateManager = new TemplateManager({path: [join(import.meta.dir, `../src/pages`)]})
export const bot = new BotCore({
  deploy: `test`,
  token: `test`,
  log: false,
  templateManager
})

process.chdir(origDir)

export const e2e = bot.e2e!
