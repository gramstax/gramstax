import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Base {
  static index = `-`
}

class Main {
  static async showIndex(ctx: ResetPage, edit = false) {
    await ctx.clearSession()
    await ctx.cacheState.delete(`${ctx.userId}:category`)
    await ctx.cacheState.delete(`${ctx.userId}:page`)

    const bi = Base.index
    const kb = ctx.inlineKeyboardT([StartPage], `1`, bi)
    const da = {}
    if (edit) {
      await ctx.edit(kb, da, bi)
    } else {
      await ctx.reply(kb, da, bi)
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
    <base id="${Base.index}">
      ${this.kbk.back()}
      <message>
        ✅ Reset complete

        Tap Back to return to the main menu.
      </message>
    </base>
  `
}
