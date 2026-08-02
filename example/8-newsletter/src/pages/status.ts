import {PageBase} from "~/base/page"
import {LogHe} from "~/helpers/log"
import {StartPage} from "./start"

class Base {
  static notFound = `nf`
}

export class StatusPage extends PageBase {
  static data = this.buildData()
  constructorName?: string

  constructor(p: ConstructorParameters<typeof PageBase>[0]) {
    super(p)
    this.constructorName = p?.constructor?.name
  }

  berror = {
    show: async (funcName: string, error: Error | unknown, isEdit = true) => {
      LogHe.errorMake(error, this.constructorName, funcName)

      await this.clearSession()
      const kb = this.inlineKeyboardT([StartPage])
      await this.renderAuto(kb, null, null, null, isEdit)
    }
  }
  bnotFound = {
    show: async () => {
      const kb = this.inlineKeyboardT([StartPage], `1`, Base.notFound)
      await this.render(kb, {}, Base.notFound)
    }
  }

  static template = `
    <g-base>
      ${this.kbk.home()}
      <g-message>
        ❌ Something went wrong. Please try again in a moment.

        If the issue persists, restart the conversation or try again later.
      </g-message>
      <g-message lang="id">
        ❌ Terjadi kesalahan. Silakan coba lagi sebentar lagi.

        Jika masalah berlanjut, mulai ulang percakapan atau coba lagi nanti.
      </g-message>
    </g-base>
    <g-base id="${Base.notFound}">
      ${this.kbk.home()}
      <g-message>
        🔎 No matching route found.

        Use the Home button to return to the main menu.
      </g-message>
      <g-message lang="id">
        🔎 Rute tidak ditemukan.

        Gunakan tombol Beranda untuk kembali ke menu utama.
      </g-message>
    </g-base>
  `
}
