import {LogHe} from "~/helpers/log"
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
    LogHe.errorMake(error, this.constructorName, funcName)

    await this.clearSession()
    const kb = this.kb()
    const da = {isNotFound: false}
    if (edit) await this.edit(kb, da)
    else await this.reply(kb, da)
  }

  async toErrorInputNotFound() {
    const kb = this.kb()
    await this.reply(kb, {isNotFound: true})
  }

  static template = `
    <base>
      ${this.kbk.home()}
      <message>
        <b>{~isNotFound ? "🔎 Route Not Found" : "❌ Error Occurred"~}</b>

        {~isNotFound ? "The requested route does not exist or is unavailable." : "Something went wrong while processing your request. Please try again."~}
      </message>
      <message lang="id">
        <b>{~isNotFound ? "🔎 Rute Tidak Ditemukan" : "❌ Terjadi Kesalahan"~}</b>

        {~isNotFound ? "Rute yang diminta tidak tersedia atau tidak ada." : "Terjadi kesalahan saat memproses permintaan. Silakan coba lagi."~}
      </message>
    </base>
  `
}
