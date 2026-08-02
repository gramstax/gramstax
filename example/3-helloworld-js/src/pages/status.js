import {PageBase} from "../base/page.js"
import {LogHe} from "../helpers/log.js"
import {StartPage} from "./start.js"

class Base {
  static notFound = `nf`
}

export class StatusPage extends PageBase {
  constructor(p) {
    super(p)
    this.constructorName = p?.constructor?.name
  }

  berror = {
    show: async (funcName, error, isEdit = true) => {
      LogHe.errorMake(error, this.constructorName, funcName)

      await this.clearSession()
      const kb = this.inlineKeyboardT([StartPage])
      if (isEdit) {
        await this.renderEdit(kb)
      } else {
        await this.render(kb)
      }
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
