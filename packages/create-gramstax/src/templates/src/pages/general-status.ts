import {LogHe} from "~/helpers/log"
import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Helper {
  static kb(ctx: GeneralStatusPage) {
    return ctx.inlineKeyboardT([StartPage])
  }
}

class Alert {
  static async error(ctx: GeneralStatusPage, funcName: string, error: any, edit = true) {
    LogHe.errorMake(error, ctx.constructorName, funcName)

    await ctx.clearSession()
    const kb = Helper.kb(ctx)
    const da = {isNotFound: false}
    if (edit) {
      await ctx.edit(kb, da)
    } else {
      await ctx.reply(kb, da)
    }
  }

  static async errorInputNotFound(ctx: GeneralStatusPage) {
    const kb = Helper.kb(ctx)
    const da = {isNotFound: true}
    await ctx.reply(kb, da)
  }
}

export class GeneralStatusPage extends PageBase {
  constructorName?: string

  constructor(p: any) {
    super(p)
    this.constructorName = p?.constructor?.name
  }

  async error(funcName: string, error: any, edit = true) {
    await Alert.error(this, funcName, error, edit)
  }

  async errorInputNotFound() {
    await Alert.errorInputNotFound(this)
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
