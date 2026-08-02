import {PageBase} from "~/base/page"
import {LogHe} from "~/helpers/log"
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

  berror = {
    show: async (funcName: string, error: Error | unknown, isEdit = true) => {
      LogHe.errorMake(error, this.constructorName, funcName)

      const bi = Base.error
      const kb = this.inlineKeyboardT([StartPage], `1`, bi)
      await this.clearSession()
      await this.renderAuto(kb, {}, bi, null, isEdit)
    }
  }

  bnotFound = {
    show: async () => {
      const bi = Base.notFound
      const kb = this.inlineKeyboardT([StartPage], `1`, bi)
      await this.render(kb, {}, bi)
    }
  }

  static template = `
    <g-base id="${Base.error}">
      ${this.kbk.home()}
      <g-message>
        ❌ Something went wrong while processing your request. Please try again.
      </g-message>
      <g-message lang="id">
        ❌ Terjadi kesalahan saat memproses permintaan. Silakan coba lagi.
      </g-message>
    </g-base>
    
    <g-base id="${Base.notFound}">
      ${this.kbk.home()}
      <g-message>
        <b>🔎 Route Not Found</b>

        The requested route does not exist or is unavailable.
      </g-message>
      <g-message lang="id">
        <b>🔎 Rute Tidak Ditemukan</b>

        Rute yang diminta tidak tersedia atau tidak ada.
      </g-message>
    </g-base>
  `
}
