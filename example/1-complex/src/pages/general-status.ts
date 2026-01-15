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
    return this.inlineKeyboard((k, a) => {
      return k.text(a[0]!, StartPage.data.callback())
    })
  }

  async toError(funcName: string, error: any, isUpdate = true) {
    log.errorMake(error, this.constructorName, funcName)

    await this.sessionClear()
    const kb = this.kb()
    const bi = `error`
    if (isUpdate === true) {
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
      ${this.kbk.home()}
    </base>

    <base id="error">
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

    <base id="error-input-notfound">
      <message>
        <b>❌ Not Found</b>
      </message>
      <message lang="id">
        <b>❌ Tidak Ditemukan</b>
      </message>
    </base>
  `
}
