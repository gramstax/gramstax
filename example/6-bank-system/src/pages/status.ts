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
      const bi = Base.error
      const kb = this.inlineKeyboardT([StartPage], `1`, bi)
      await this.renderAuto(kb, {}, bi)
    },
    process: () => {}
  }
  gnotFound = {
    show: async () => {
      const bi = Base.notFound
      const kb = this.inlineKeyboardT([StartPage], `1`, bi)
      await this.renderAuto(kb, {}, bi)
    },
    process: () => {}
  }

  static template = `
    <g-base id="${Base.error}">
      ${this.kbk.home()}
      <g-message>
        ❌ Something went wrong

        Please try again in a moment, or return Home if the issue persists.
      </g-message>
      <g-message lang="id">
        ❌ Terjadi kesalahan

        Silakan coba lagi sebentar, atau kembali ke Beranda jika masalah berlanjut.
      </g-message>
    </g-base>
    <g-base id="${Base.notFound}">
      ${this.kbk.home()}
      <g-message>
        🔎 Route not found

        Use Home to return to the main menu and try a different action.
      </g-message>
      <g-message lang="id">
        🔎 Rute tidak ditemukan

        Gunakan Beranda untuk kembali ke menu utama dan coba tindakan lain.
      </g-message>
    </g-base>
  `
}
