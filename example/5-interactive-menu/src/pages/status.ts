import {PageBase} from "~/base/page"
import {LogHe} from "~/helpers/log"
import {StartPage} from "./start"

class Base {
  static error = `e`
  static notFound = `nf`
}

class Helper {
  static async built(ctx: StatusPage) {
    const bi = Base.error
    const kb = ctx.inlineKeyboardT([StartPage], `1`, bi)
    await ctx.renderAuto(kb, {}, bi)
  }
}

export class StatusPage extends PageBase {
  static data = this.buildData()
  constructorName?: string

  constructor(p: ConstructorParameters<typeof PageBase>[0]) {
    super(p)
    this.constructorName = p?.constructor?.name
  }

  berror = {
    show: async (funcName: string, error: Error | unknown) => {
      LogHe.errorMake(error, this.constructorName, funcName)
      await this.clearSession()
      await Helper.built(this)
    }
  }
  bnotFound = {
    show: async () => {
      const kb = this.inlineKeyboardT([StartPage], `1`, Base.notFound)
      await this.renderAuto(kb, {}, Base.notFound)
    }
  }

  static template = `
    <g-base id="${Base.error}">
      ${this.kbk.home()}
      <g-message>
        ❌ Something went wrong

        Please try again in a moment, or return Home if the issue persists.
      </g-message>
      <g-message lang="id">
        ❌ Terjadi kesalahan

        Silakan coba lagi sebentar, atau kembali ke Beranda jika masalah berlanjut.
      </g-message>
    </g-base>
    <g-base id="${Base.notFound}">
      ${this.kbk.home()}
      <g-message>
        🔎 Route not found

        Use Home to return to the main menu and try a different action.
      </g-message>
      <g-message lang="id">
        🔎 Rute tidak ditemukan

        Gunakan Beranda untuk kembali ke menu utama dan coba tindakan lain.
      </g-message>
    </g-base>
  `
}
