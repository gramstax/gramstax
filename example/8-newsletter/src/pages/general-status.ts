import {LogHe} from "~/helpers/log"
import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Base {}

class Helper {
  static kb(ctx: GeneralStatusPage) {
    return ctx.inlineKeyboardT([StartPage])
  }
}

class Perform {
  static async show(ctx: GeneralStatusPage, isNotFound: boolean, edit = true) {
    const kb = Helper.kb(ctx)
    const data = {isNotFound}
    if (edit) await ctx.edit(kb, data)
    else await ctx.reply(kb, data)
  }
}

class Alert {
  static async error(ctx: GeneralStatusPage, funcName: string, error: any, edit = true) {
    LogHe.errorMake(error, ctx.constructorName, funcName)

    await ctx.clearSession()
    await Perform.show(ctx, false, edit)
  }

  static async errorInputNotFound(ctx: GeneralStatusPage) {
    await Perform.show(ctx, true, false)
  }
}

export class GeneralStatusPage extends PageBase {
  static BASE = Base
  constructorName?: string

  constructor(p: any) {
    super(p)
    this.constructorName = p?.constructor?.name
  }

  async toError(funcName: string, error: any, edit = true) {
    await Alert.error(this, funcName, error, edit)
  }

  async toErrorInputNotFound() {
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
