import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Perform {
  static async entryPoint(ctx: HelpPage, edit = true) {
    const kb = ctx.inlineKeyboardT([StartPage])
    if (edit) {
      await ctx.edit(kb)
    } else {
      await ctx.reply(kb)
    }
  }
}

// Help page lists available commands.
export class HelpPage extends PageBase {
  async handleCommandText() {
    await Perform.entryPoint(this, false)
  }

  async handleCallbackData() {
    await Perform.entryPoint(this, true)
  }

  static template = `
    <base>
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
