import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Base {
  static index = `-`
}

class Main {
  static async showIndex(ctx: HelpPage) {
    const bi = Base.index
    const kb = ctx.inlineKeyboardT([StartPage], `1`, bi)
    const da = {}
    await ctx.edit(kb, da, bi)
  }
}

export class HelpPage extends PageBase {
  async handleCallbackData() {
    await Main.showIndex(this)
  }

  static template = `
    <base id="${Base.index}">
      ${this.kbk.back()}
      <message>
        ❓ Help & Navigation

        Use the menu to explore each demo page. Most pages can be refreshed, and you can always return Home.
      </message>
      <message lang="id">
        ❓ Bantuan & Navigasi

        Gunakan menu untuk menjelajahi setiap halaman demo. Sebagian besar halaman bisa disegarkan, dan Anda selalu dapat kembali ke Beranda.
      </message>
    </base>
  `
}
