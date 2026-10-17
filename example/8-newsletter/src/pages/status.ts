import {log} from "gramstax"
import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Base {
  static error = `e`
  static notFound = `nf`
}

export class StatusPage extends PageBase {
  static data = this.buildData()
  constructorName?: string

  constructor(p: ConstructorParameters<typeof PageBase>[0]) {
    super(p)
    this.constructorName = p?.constructor?.name
  }

  helper = {}
  gerror = {
    show: async (funcName: string, error: Error | unknown) => {
      log.errorMake(error, this.constructorName, funcName)

      await this.clearSession()
      await this.renderText({AGBaseId: Base.error, keyboard: this.inlineKeyboardT([StartPage], `1`, Base.error)})
    },
    process: () => {}
  }
  gnotFound = {
    show: async () => {
      await this.renderText({AGBaseId: Base.notFound, keyboard: this.inlineKeyboardT([StartPage], `1`, Base.notFound)})
    },
    process: () => {}
  }

  static template = `
    <g-base id="${Base.error}">
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
