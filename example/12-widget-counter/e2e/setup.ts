import {join} from "node:path"
import {TemplateManager} from "gramstax"
import {BotCore} from "../src/core/bot"

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

let updateId = 1000

/** Simulate a tap inside the widget: a `widget_query` update carrying the request data. */
export async function sendWidgetQuery(data: string, user: typeof enUser, messageId = 101) {
  return await e2e.handleUpdate({
    update_id: updateId++,
    widget_query: {
      id: `q-${updateId}`,
      from: {id: user.user.id, is_bot: false, first_name: `Test`, language_code: user.user.language_code},
      chat: {id: user.chat.id, type: `private`},
      message_id: messageId,
      data
    }
  })
}
