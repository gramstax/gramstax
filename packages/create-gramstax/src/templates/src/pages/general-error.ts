import {logUt} from "~/utils/log"
import {PageBase} from "~/base/page"
import {StartPage} from "./start"

export class GeneralErrorPage extends PageBase {
  constructorName?: string
  constructor(p: any) {
    super(p)
    this.constructorName = p?.constructor?.name
  }

  kb() {
    return this.ikb((k, a) => {
      return k.text(a[0]!, StartPage.data.callbackData())
    })
  }

  async transition(funcName: string, error: unknown, isUpdate = true) {
    logUt.errorMake(error, this.constructorName, funcName)
    await this.sessionClear()

    const kb = this.kb()
    if (isUpdate === true) {
      await this.edit(kb)
    } else {
      await this.reply(kb)
    }
  }

  static template = `
    <base>
      ${this.kbc.home()}
      <message>
        <b>❌ Error</b>

        An unexpected error occurred.
        Please try again later.
      </message>
      <message lang="it">
        <b>❌ Errore</b>

        Si è verificato un errore imprevisto.
        Riprova più tardi.
      </message>
      <message lang="id">
        <b>❌ Kesalahan</b>

        Terjadi kesalahan yang tidak diharapkan.
        Silakan coba lagi nanti.
      </message>
    </base>
  `
}
