import {PageBase} from "~/base/page"
import {LogHe} from "~/helpers/log"
import {StartPage} from "./start"

class Base {
  static notFound = `nf`
}

class Helper {
  static async built(ctx: StatusPage, isEdit = true) {
    const kb = ctx.inlineKeyboardT([StartPage])
    await ctx.renderAuto(kb, null, null, null, isEdit)
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
    show: async (funcName: string, error: Error | unknown, isEdit = true) => {
      LogHe.errorMake(error, this.constructorName, funcName)
      await this.clearSession()
      await Helper.built(this, isEdit)
    }
  }
  bnotFound = {
    show: async () => {
      const kb = this.inlineKeyboardT([StartPage], `1`, Base.notFound)
      await this.render(kb, {}, Base.notFound)
    }
  }

  static template = `
    <g-base>
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
