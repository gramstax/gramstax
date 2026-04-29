import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Main {
  static async showEntryPoint(ctx: HelpPage, edit = true) {
    const kb = ctx.inlineKeyboardT([StartPage])
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
    await Main.showEntryPoint(this, true)
  }

  async handleText() {
    await Main.showEntryPoint(this, false)
  }

  static template = `
    <base>
      ${this.kbk.back()}
      <message>
        ❓ Help & Navigation

        Use inline buttons to explore menus, and the bottom keyboard for quick actions.
        Pagination buttons appear when lists are long.
      </message>
    </base>
  `
}
