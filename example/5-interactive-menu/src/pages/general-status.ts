import {log} from "gramstax"
import {PageBase} from "~/base/page"
import {StartPage} from "./start"

// Error/fallback page used by hooks.
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
    const kb = this.kb()
    const baseId = `error`
    if (isUpdate) {
      await this.edit(kb, {}, baseId)
    } else {
      await this.reply(kb, {}, baseId)
    }
  }

  async toErrorInputNotFound() {
    const kb = this.kb()
    await this.reply(kb, {}, `error-input-notfound`)
  }

  static template = `
    <base>
      ${this.kbp.back()}
    </base>

    <base id="error">
      <message>
        <b>❌ Error</b>

        Something went wrong in the menu flow.
      </message>
    </base>

    <base id="error-input-notfound">
      <message>
        <b>❌ Not Found</b>

        Use the menu buttons to navigate.
      </message>
    </base>
  `
}
