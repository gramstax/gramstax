import {join} from "node:path"
import {type IE2eApiCall, TemplateManager} from "gramstax"
import {BotCore} from "../src/core/bot"

export type {IE2eApiCall, IE2eUpdateOptions} from "gramstax"

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

/** Extract flattened bottom keyboard button label strings from a Telegram API response body. */
export function bottomButtonLabels(resp: IE2eApiCall): string[] {
  const labels = e2e.bodyOf<{reply_markup?: {keyboard?: Array<Array<{text?: string}>>}}>(resp)?.reply_markup?.keyboard?.flat().map((b) => b.text)
  return labels?.filter((label): label is string => typeof label === `string`) ?? []
}
