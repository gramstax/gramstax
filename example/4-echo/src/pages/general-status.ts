import {log} from "gramstax"
import {PageBase} from "~/base/page"
import {StartPage} from "./start"

// Error/fallback page for unified error messaging.
export class GeneralStatusPage extends PageBase {
  constructorName?: string
  constructor(p: any) {
    super(p)
    this.constructorName = p?.constructor?.name
  }

  kb() {
    return this.inlineKeyboard((k, a) => {
      return k.text(a[0]!, StartPage.data.callback())
    })
  }

  async toError(funcName: string, error: any, isUpdate = true) {
    log.errorMake(error, this.constructorName, funcName)

    await this.sessionClear()
    const kb = this.kb()
    const bi = `error`
    if (isUpdate) {
      await this.edit(kb, {}, bi)
    } else {
      await this.reply(kb, {}, bi)
    }
  }

  async toErrorInputNotFound() {
    const kb = this.kb()
    const bi = `error-input-notfound`
    await this.reply(kb, {}, bi)
  }

  static template = `
    <base>
      <keyboard>Back to Start</keyboard>
    </base>

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
