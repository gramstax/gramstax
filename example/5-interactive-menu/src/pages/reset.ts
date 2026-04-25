import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Base {
  static reset: `reset`
}

class Perform {
  static async entryPoint(ctx: ResetPage, edit = false) {
    await ctx.cacheState.delete(`${ctx.userId}:category`)
    await ctx.cacheState.delete(`${ctx.userId}:page`)
    await ctx.clearSession()

    const kb = ctx.inlineKeyboardT([StartPage])
    const bi = Base.reset
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

  async entryPoint(edit = false) {
    await Perform.entryPoint(this, edit)
  }

  async handleCallbackData() {
    await Perform.entryPoint(this, true)
  }

  async handleText() {
    await Perform.entryPoint(this, false)
  }

  static template = `
    <base>
      ${this.kbk.back()}
      <message>
        ♻️ State reset

        Your navigation state has been cleared. You can start fresh from the main menu.
      </message>
    </base>

    <base id="${Base.reset}">
      <message>
        ✅ Reset complete

        Tap Back to return to the main menu.
      </message>
    </base>
  `
}
