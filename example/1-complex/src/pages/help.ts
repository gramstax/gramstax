import {PageBase} from "~/base/page"
import {StartPage} from "./start"

export class HelpPage extends PageBase {
  async handleCallbackData() {
    const kb = this.inlineKeyboardT([StartPage])
    await this.edit(kb)
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
