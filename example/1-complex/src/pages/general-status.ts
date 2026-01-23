import {log} from "~/utils/log"
import {PageBase} from "~/base/page"
import {StartPage} from "./start"

export class GeneralStatusPage extends PageBase {
  static BASE = {error: `error`, notFound: `not-found`}
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
    const bi = GeneralStatusPage.BASE.error
    if (edit) await this.edit(kb, {}, bi)
    else await this.reply(kb, {}, bi)
  }

  async toErrorInputNotFound() {
    await this.reply(this.kb(), {}, GeneralStatusPage.BASE.notFound)
  }

  static template = `
    <base>
      ${this.kbk.home()}
    </base>

    <base id="${this.BASE.error}">
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

    <base id="${this.BASE.notFound}">
      <message>
        <b>❌ Not Found</b>

        Not maching route.
      </message>
      <message lang="id">
        <b>❌ Tidak Ditemukan</b>

        Tidak ada route terdeteksi.
      </message>
    </base>
  `
}
