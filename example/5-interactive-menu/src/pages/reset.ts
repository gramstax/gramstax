import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Base {
  static step1 = `s1`
}

class Main {
  static async showStep1Form(ctx: ResetPage, edit = false) {
    await ctx.clearSession()
    await ctx.cacheState.delete(`${ctx.userId}:category`)
    await ctx.cacheState.delete(`${ctx.userId}:page`)

    const bi = Base.step1
    const kb = ctx.inlineKeyboardT([StartPage], `1`, bi)
    const da = {}
    if (edit) {
      await ctx.edit(kb, da, bi)
    } else {
      await ctx.reply(kb, da, bi)
    }
  }

  static async processStep1Answer(ctx: ResetPage) {
    throw ctx
  }
}

// Reset state and return to main menu.
export class ResetPage extends PageBase {
  static data = this.buildData({intentText: `Reset`})

  async handleCallbackData() {
    await Main.showStep1Form(this, true)
  }

  async handleText() {
    await Main.showStep1Form(this, false)
  }

  async showStep1Form(edit = false) {
    await Main.showStep1Form(this, edit)
  }

  static template = `
    <base id="${Base.step1}">
      ${this.kbk.back()}
      <message>
        ✅ Reset complete

        Tap Back to return to the main menu.
      </message>
    </base>
  `
}
