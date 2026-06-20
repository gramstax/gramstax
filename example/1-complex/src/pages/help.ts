import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Base {
  static step1 = `s1`
}

class Main {
  static async showStep1Form(ctx: HelpPage) {
    const bi = Base.step1
    const kb = ctx.inlineKeyboardT([StartPage], `1`, bi)
    const da = {}
    await ctx.edit(kb, da, bi)
  }

  static async processStep1Answer(ctx: HelpPage) {
    throw ctx
  }
}

export class HelpPage extends PageBase {
  async handleCallbackData() {
    await Main.showStep1Form(this)
  }

  static template = `
    <g-base id="${Base.step1}">
      ${this.kbk.back()}
      <g-message>
        ❓ Help & Navigation

        Use the menu to explore each demo page. Most pages can be refreshed, and you can always return Home.
      </g-message>
      <g-message lang="id">
        ❓ Bantuan & Navigasi

        Gunakan menu untuk menjelajahi setiap halaman demo. Sebagian besar halaman bisa disegarkan, dan Anda selalu dapat kembali ke Beranda.
      </g-message>
    </g-base>
  `
}
