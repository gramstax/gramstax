import {LogHe} from "~/helpers/log"
import {PageBase} from "~/base/page"
import {StartPage} from "./start"

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
      const kb = this.inlineKeyboardT([StartPage])
      const da = {isNotFound: false}
      if (isEdit) {
        await this.edit(kb, da)
      } else {
        await this.reply(kb, da)
      }
    }
  }
  berrorInputNotFound = {
    show: async () => {
      const kb = this.inlineKeyboardT([StartPage])
      const da = {isNotFound: true}
      await this.reply(kb, da)
    }
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
