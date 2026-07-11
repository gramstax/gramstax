import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Main {
  static async showIndex(ctx: ResetPage, edit = false) {
    await ctx.clearSession()
    await ctx.cacheState.delete(`${ctx.userId}:category`)
    await ctx.cacheState.delete(`${ctx.userId}:page`)

    const kb = ctx.inlineKeyboardT([StartPage], `1`)
    const da = {}
    if (edit) {
      await ctx.edit(kb, da)
    } else {
      await ctx.reply(kb, da)
    }
  }
}

// Reset state and return to main menu.
export class ResetPage extends PageBase {
  static data = this.buildData({intentText: `Reset`})

  async handleCallbackData() {
    await Main.showIndex(this, true)
  }

  async handleText() {
    await Main.showIndex(this, false)
  }

  async showIndex(edit = false) {
    await Main.showIndex(this, edit)
  }

  static template = `
    <g-base>
      ${this.kbk.back()}
      <g-message>
        ✅ Reset complete

        Tap Back to return to the main menu.
      </g-message>
      <g-message lang="id">
        ✅ Atur ulang selesai

        Ketuk Kembali untuk kembali ke menu utama.
      </g-message>
    </g-base>
  `
}
