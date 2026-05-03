import {LogHe} from "~/helpers/log"
import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Base {
  static index = `-`
}

class Helper {
  static kb(ctx: GeneralStatusPage) {
    const bi = Base.index
    const kb = ctx.inlineKeyboardT([StartPage], `1`, bi)
    return kb
  }
}

class Alert {
  static async showError(ctx: GeneralStatusPage, funcName: string, error: any, edit = true) {
    LogHe.errorMake(error, ctx.constructorName, funcName)

    await ctx.clearSession()
    const bi = Base.index
    const kb = Helper.kb(ctx)
    const da = {isNotFound: false}
    if (edit) {
      await ctx.edit(kb, da, bi)
    } else {
      await ctx.reply(kb, da, bi)
    }
  }

  static async showErrorInputNotFound(ctx: GeneralStatusPage) {
    const bi = Base.index
    const kb = Helper.kb(ctx)
    const da = {isNotFound: true}
    await ctx.reply(kb, da, bi)
  }
}

export class GeneralStatusPage extends PageBase {
  constructorName?: string

  constructor(p: any) {
    super(p)
    this.constructorName = p?.constructor?.name
  }

  async showError(...args: Parameters<typeof Alert.showError> extends [any, ...infer R] ? R : []) {
    await Alert.showError(this, ...args)
  }

  async showErrorInputNotFound() {
    await Alert.showErrorInputNotFound(this)
  }

  static template = `
    <base id="${Base.index}">
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
