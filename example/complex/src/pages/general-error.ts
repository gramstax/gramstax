import {log} from "gramstax"
import {PageBase} from "~/base/page"
import {StartPage} from "./start"

export class GeneralErrorPage extends PageBase {
  constructorName?: string
  constructor(p: any) {
    super(p)
    this.constructorName = p?.constructor?.name
  }

  kb() {
    return this.inlineKeyboard((kb, arr) => {
      return kb.text(arr[0]!, StartPage.data.callbackData())
    })
  }

  async transition(funcName: string, error: any, isUpdate = true) {
    log.errorMake(error, this.constructorName, funcName)

    await this.sessionClear()
    const kb = this.kb()
    if (isUpdate === true) {
      await this.edit(kb)
    } else {
      await this.reply(kb)
    }
  }

  static template = /*jsx*/ `
    <base>
      ${this.kbc.home()}
      <message>
        <b>❌ Error</b>

        An unexpected error occurred.
        Please try again later.
      </message>
      <message lang="id">
        <b>❌ Kesalahan</b>

        Terjadi kesalahan yang tidak diharapkan.
        Silakan coba lagi nanti.
      </message>
    </base>
  `
}
