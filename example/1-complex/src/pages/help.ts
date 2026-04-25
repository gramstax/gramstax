import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Perform {
  static async entryPoint(ctx: HelpPage) {
    const kb = ctx.inlineKeyboardT([StartPage])
    await ctx.edit(kb)
  }
}

export class HelpPage extends PageBase {
  async handleCallbackData() {
    await Perform.entryPoint(this)
  }

  static template = `
    <base>
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
