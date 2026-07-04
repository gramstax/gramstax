import {LogHe} from "~/helpers/log"
import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Helper {
  static async built(ctx: GeneralStatusPage, isNotFound: boolean, edit = true) {
    const kb = ctx.inlineKeyboardT([StartPage])
    const da = {isNotFound}
    if (edit) {
      await ctx.edit(kb, da)
    } else {
      await ctx.reply(kb, da)
    }
  }
}

class Main {
  static async showError(ctx: GeneralStatusPage, funcName: string, error: any, edit = true) {
    LogHe.errorMake(error, ctx.constructorName, funcName)
    await ctx.clearSession()
    await Helper.built(ctx, false, edit)
  }

  static async showErrorInputNotFound(ctx: GeneralStatusPage) {
    await Helper.built(ctx, true, false)
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
        {~isNotFound ? "🔎 Route not found" : "❌ Something went wrong"~}

        {~isNotFound ? "Use Home to return to the main menu and try a different action." : "Please try again in a moment, or return Home if the issue persists."~}
      </g-message>
      <g-message lang="id">
        {~isNotFound ? "🔎 Rute tidak ditemukan" : "❌ Terjadi kesalahan"~}

        {~isNotFound ? "Gunakan Beranda untuk kembali ke menu utama dan coba tindakan lain." : "Silakan coba lagi sebentar, atau kembali ke Beranda jika masalah berlanjut."~}
      </g-message>
    </g-base>
  `
}
