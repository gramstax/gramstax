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
        {~isNotFound ? "🔎 No matching route found." : "❌ Something went wrong. Please try again in a moment."~}

        {~isNotFound ? "Use the Home button to return to the main menu." : "If the issue persists, restart the conversation or try again later."~}
      </message>
      <message lang="id">
        {~isNotFound ? "🔎 Rute tidak ditemukan." : "❌ Terjadi kesalahan. Silakan coba lagi sebentar lagi."~}

        {~isNotFound ? "Gunakan tombol Beranda untuk kembali ke menu utama." : "Jika masalah berlanjut, mulai ulang percakapan atau coba lagi nanti."~}
      </message>
    </base>
  `
}
