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
    return this.ikb((k, a) => k.text(a[0]!, StartPage.data.callback()))
  }

  async toError(funcName: string, error: any, isUpdate = true) {
    log.errorMake(error, this.constructorName, funcName)
    await this.sessionClear()
    const bi = `error`
    const kb = this.kb()
    await (isUpdate ? this.edit : this.reply)(kb, {}, bi)
  }

  async toErrorInputNotFound() {
    const bi = `error-input-notfound`
    const kb = this.kb()
    await this.reply(kb, {}, bi)
  }

  static template = `
    <base>
      <keyboard>Home</keyboard>
    </base>

    <base id="error">
      <message>
        <b>❌ Error</b>

        An error occurred while processing your request.
        Please try again or select Home to return to the main menu.
      </message>
    </base>

    <base id="error-input-notfound">
      <message>
        <b>❌ Not Found</b>

        Command not recognized.
        Use /start or select Home to return to the main menu.
      </message>
    </base>
  `
}
