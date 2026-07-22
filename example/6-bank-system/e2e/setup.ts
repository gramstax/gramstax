import {join} from "node:path"
import {BotCore} from "../src/core/bot"
import {TransferPage} from "../src/pages/transfer"
import {TemplateManager} from "gramstax"
export type {ITE2eApiCall, ITE2eUpdateOptions} from "gramstax"

// Monkey-patch TransferPage to call setSessionFreeText on callback,
// matching the existing test setup.
const originalTransferHandleCallbackQueryData = TransferPage.prototype.handleCallbackQueryData
TransferPage.prototype.handleCallbackQueryData = async function () {
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
