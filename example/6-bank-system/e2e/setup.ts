import {join} from "node:path"
import {TemplateManager} from "gramstax"
import {BotCore} from "../src/core/bot"
import {StartTransferPage} from "../src/pages/start/transfer"

export type {ITE2eApiCall, ITE2eUpdateOptions} from "gramstax"

// Monkey-patch TransferPage to call setSessionFreeText on callback,
// matching the existing test setup.
const originalTransferHandleCallbackQueryData = StartTransferPage.prototype.handleCallbackQueryData
StartTransferPage.prototype.handleCallbackQueryData = async function () {
  await this.setSessionFreeText()
  await originalTransferHandleCallbackQueryData.call(this)
}

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
