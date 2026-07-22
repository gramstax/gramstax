import {LogHe} from "~/helpers/log"
import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Helper {
  static async built(ctx: GeneralStatusPage, isNotFound: boolean, isEdit = true) {
    const kb = ctx.inlineKeyboardT([StartPage])
    const da = {isNotFound}
    await ctx.renderAuto(kb, da, null, null, isEdit)
  }
}

export class GeneralStatusPage extends PageBase {
  constructorName?: string

  constructor(p: any) {
    super(p)
    this.constructorName = p?.constructor?.name
  }

  berror = {
    show: async (funcName: string, error: any, isEdit = true) => {
      LogHe.errorMake(error, this.constructorName, funcName)
      await this.clearSession()
      await Helper.built(this, false, isEdit)
    }
  }
  berrorInputNotFound = {
    show: async () => {
      await Helper.built(this, true, false)
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
        {~isNotFound ? "🔎 Rute tidak ditemukan" : "❌ Terjadi kesalahan"~}

        {~isNotFound ? "Gunakan Beranda untuk kembali ke menu utama dan coba tindakan lain." : "Silakan coba lagi sebentar, atau kembali ke Beranda jika masalah berlanjut."~}
      </g-message>
    </g-base>
  `
}
