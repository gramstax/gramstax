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

// Help page lists available commands.
export class HelpPage extends PageBase {
  async handleCommandText() {
    await Main.showStep1Form(this, false)
  }

  async handleCallbackData() {
    await Main.showStep1Form(this, true)
  }

  static template = `
    <base id="${Base.step1}">
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
