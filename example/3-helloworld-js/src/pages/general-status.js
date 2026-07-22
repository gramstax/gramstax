import {LogHe} from "../helpers/log.js"
import {PageBase} from "../base/page.js"
import {StartPage} from "./start.js"

export class GeneralStatusPage extends PageBase {
  constructor(p) {
    super(p)
    this.constructorName = p?.constructor?.name
  }

  berror = {
    show: async (funcName, error, isEdit = true) => {
      LogHe.errorMake(error, this.constructorName, funcName)

      await this.clearSession()
      const kb = this.inlineKeyboardT([StartPage])
      const da = {isNotFound: false}
      if (isEdit) {
        await this.renderEdit(kb, da)
      } else {
        await this.render(kb, da)
      }
    }
  }
  berrorInputNotFound = {
    show: async () => {
      const kb = this.inlineKeyboardT([StartPage])
      const da = {isNotFound: true}
      await this.render(kb, da)
    }
  }

  static template = `
    <g-base>
      ${this.kbk.home()}
      <g-message>
        {~isNotFound ? "🔎 Route not found" : "❌ Something went wrong"~}

        {~isNotFound ? "Use Home to return to the main menu and try a different action." : "Please try again in a moment, or return Home if the issue persists."~}
      </g-message>
      <g-message lang="id">
        {~isNotFound ? "🔎 Rute tidak ada" : "❌ Ada kesalahan"~}

        {~isNotFound ? "Gunakan rumah untuk kembali ke main menu dan coba aksi berbeda." : "Mohon coba kembali beberapa saat atau kembali ke rumah jika masalah ini masih ada."~}
      </g-message>
    </g-base>
  `
}
