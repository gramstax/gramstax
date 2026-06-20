import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Base {
  static step1 = `s1`
}

class Main {
  static async showStep1Form(ctx: HelpPage, edit = true) {
    const bi = Base.step1
    const kb = ctx.inlineKeyboardT([StartPage], `1`, bi)
    const da = {}
    if (edit) {
      await ctx.edit(kb, da, bi)
    } else {
      await ctx.reply(kb, da, bi)
    }
  }

  static async processStep1Answer(ctx: HelpPage) {
    throw ctx
  }
}

// Help page describing navigation rules.
export class HelpPage extends PageBase {
  static data = this.buildData({intentText: `Help`})

  async handleCallbackData() {
    await Main.showStep1Form(this, true)
  }

  async handleText() {
    await Main.showStep1Form(this, false)
  }

  static template = `
    <g-base id="${Base.step1}">
      ${this.kbk.back()}
      <g-message>
        ❓ Help & Navigation

        Use inline buttons to explore menus, and the bottom keyboard for quick actions.
        Pagination buttons appear when lists are long.
      </g-message>
    </g-base>
  `
}
