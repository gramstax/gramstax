import {LogHe} from "~/helpers/log"
import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Main {
  static async showError(ctx: GeneralStatusPage, funcName: string, error: any, edit = true) {
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

  static async showErrorInputNotFound(ctx: GeneralStatusPage) {
    const kb = ctx.inlineKeyboardT([StartPage])
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

  async showError(...args: Parameters<typeof Main.showError> extends [any, ...infer R] ? R : []) {
    await Main.showError(this, ...args)
  }

  async showErrorInputNotFound() {
    await Main.showErrorInputNotFound(this)
  }

  static template = `
    <g-base>
      ${this.kbk.home()}
      <g-message>
        {~isNotFound ? "🔎 No matching route found." : "❌ Something went wrong. Please try again in a moment."~}

        {~isNotFound ? "Use the Home button to return to the main menu." : "If the issue persists, restart the conversation or try again later."~}
      </g-message>
      <g-message lang="id">
        {~isNotFound ? "🔎 Rute tidak ditemukan." : "❌ Terjadi kesalahan. Silakan coba lagi sebentar lagi."~}

        {~isNotFound ? "Gunakan tombol Beranda untuk kembali ke menu utama." : "Jika masalah berlanjut, mulai ulang percakapan atau coba lagi nanti."~}
      </g-message>
    </g-base>
  `
}
