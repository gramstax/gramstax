import {join} from "node:path"
import {type ITE2eApiCall, TemplateManager} from "gramstax"
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

/** Extract flattened bottom keyboard button label strings from a Telegram API response body. */
export function bottomButtonLabels(resp: ITE2eApiCall): string[] {
  return resp?.body?.reply_markup?.keyboard?.flat().map((b: {text: unknown}) => b.text) ?? []
}
