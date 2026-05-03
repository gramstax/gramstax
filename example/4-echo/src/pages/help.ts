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

// Help page lists available commands.
export class HelpPage extends PageBase {
  async handleCommandText() {
    await Main.showIndex(this, false)
  }

  async handleCallbackData() {
    await Main.showIndex(this, true)
  }

  static template = `
    <base id="${Base.index}">
      ${this.kbk.back()}
      <message>
        ❓ Help
        
        Available commands:
        - /start: Welcome message
        - /help: Show this help

        You can also send any message to echo it back.
      </message>
    </base>
  `
}
