import {LogHe} from "../helpers/log.js"
import {PageBase} from "../base/page.js"
import {StartPage} from "./start.js"

class Main {
  static async showError(ctx, funcName, error, edit = true) {
    LogHe.errorMake(error, ctx.constructorName, funcName)

    await ctx.clearSession()
    const kb = ctx.inlineKeyboardT([StartPage])
    const da = {isNotFound: false}
    if (edit) {
      await ctx.edit(kb, da)
    } else {
      await ctx.reply(kb, da)
    }
  }

  static async showErrorInputNotFound(ctx) {
    const kb = ctx.inlineKeyboardT([StartPage])
    const da = {isNotFound: true}
    await ctx.reply(kb, da)
  }
}

export class GeneralStatusPage extends PageBase {
  constructorName

  constructor(p) {
    super(p)
    this.constructorName = p?.constructor?.name
  }

  async showError(...args) {
    await Main.showError(this, ...args)
  }

  async showErrorInputNotFound() {
    await Main.showErrorInputNotFound(this)
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
