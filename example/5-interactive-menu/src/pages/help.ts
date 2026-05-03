import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Base {
  static index = `-`
}

class Main {
  static async showIndex(ctx: HelpPage, edit = true) {
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
    <base id="${Base.index}">
      ${this.kbk.back()}
      <message>
        ❓ Help & Navigation

        Use inline buttons to explore menus, and the bottom keyboard for quick actions.
        Pagination buttons appear when lists are long.
      </message>
    </base>
  `
}
