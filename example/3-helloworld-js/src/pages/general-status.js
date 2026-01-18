import {log} from "~/utils/log"
import {PageBase} from "~/base/page"
import {StartPage} from "./start"

// Error/fallback page for unified error messaging.
export class GeneralStatusPage extends PageBase {
  constructorName
  constructor(p) {
    super(p)
    this.constructorName = p?.constructor?.name
  }

  kb() {
    return this.inlineKeyboardT([StartPage])
  }

  async toError(funcName, error, edit = true) {
    log.errorMake(error, this.constructorName, funcName)

    await this.sessionClear()
    const kb = this.kb()
    const bi = `error`
    if (edit) await this.edit(kb, {}, bi)
    else await this.reply(kb, {}, bi)
  }

  async toErrorInputNotFound() {
    const kb = this.kb()
    const bi = `error-input-notfound`
    await this.reply(kb, {}, bi)
  }

  static template = `
    <base>${this.kbk.home(`default`)}</base>

    <base id="error">
      <message>
        <b>❌ Error</b>

        Something went wrong. Please try again.
      </message>
    </base>

    <base id="error-input-notfound">
      <message>
        <b>❌ Not Found</b>

        No matching command. Try /help.
      </message>
    </base>
  `
}
