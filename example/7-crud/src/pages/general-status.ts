import {log} from "~/utils/log"
import {PageBase} from "~/base/page"
import {StartPage} from "./start"

export class GeneralStatusPage extends PageBase {
  constructorName?: string

  constructor(p: any) {
    super(p)
    this.constructorName = p?.constructor?.name
  }

  kb() {
    return this.inlineKeyboardT([StartPage])
  }

  async toError(funcName: string, error: any, edit = true) {
    log.errorMake(error, this.constructorName, funcName)

    await this.sessionClear()
    const kb = this.kb()
    const data = {isNotFound: false}
    if (edit) await this.edit(kb, data)
    else await this.reply(kb, data)
  }

  async toErrorInputNotFound() {
    const kb = this.kb()
    await this.reply(kb, {isNotFound: true})
  }

  static template = `
    <base>
      ${this.kbk.home()}
      <message>
        {~isNotFound ? "🔎 No matching route found." : "❌ Something went wrong. Please try again."~}
      </message>
    </base>
  `
}
