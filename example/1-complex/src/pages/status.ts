import {PageBase} from "~/base/page"
import {LogHe} from "~/helpers/log"
import {StartPage} from "~/pages/start"

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
        ❌ Something went wrong

        Please try again in a moment, or return Home if the issue persists.
      </g-message>
      <g-message lang="id">
        ❌ Ada kesalahan

        Mohon coba kembali beberapa saat atau kembali ke rumah jika masalah ini masih ada.
      </g-message>
    </g-base>
    <g-base id="${Base.notFound}">
      ${this.kbk.home()}
      <g-message>
        🔎 Route not found

        Use Home to return to the main menu and try a different action.
      </g-message>
      <g-message lang="id">
        🔎 Rute tidak ada

        Gunakan rumah untuk kembali ke main menu dan coba aksi berbeda.
      </g-message>
    </g-base>
  `
}
