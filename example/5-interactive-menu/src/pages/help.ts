import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Main {
  static async showIndex(ctx: HelpPage, edit = true) {
    const kb = ctx.inlineKeyboardT([StartPage], `1`)
    const da = {}
    if (edit) {
      await ctx.edit(kb, da)
    } else {
      await ctx.reply(kb, da)
    }
  }
}

// Help page describing navigation rules.
export class HelpPage extends PageBase {
  static data = this.buildData({intentText: `Help`})

  async handleCallbackData() {
    await Main.showIndex(this, true)
  }

  async handleText() {
    await Main.showIndex(this, false)
  }

  static template = `
    <g-base>
      ${this.kbk.back()}
      <g-message>
        ❓ Help & Navigation

        Use inline buttons to explore menus, and the bottom keyboard for quick actions.
        Pagination buttons appear when lists are long.
      </g-message>
      <g-message lang="id">
        ❓ Bantuan & Navigasi

        Gunakan tombol inline untuk menjelajahi menu, dan keyboard bawah untuk aksi cepat.
        Tombol paginasi muncul ketika daftar panjang.
      </g-message>
    </g-base>
  `
}
