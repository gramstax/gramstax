import {PageBase} from "~/base/page"
import {HelpPage} from "./help"
import {EchoPage} from "./echo"

class Main {
  static async showEntryPoint(ctx: StartPage, edit = true) {
    const kb = ctx.inlineKeyboardT([HelpPage, EchoPage])
    if (edit) {
      await ctx.edit(kb)
    } else {
      await ctx.reply(kb)
    }
  }
}

// Start page with welcome message and navigation.
export class StartPage extends PageBase {
  async handleCommandText() {
    await Main.showEntryPoint(this, false)
  }

  async handleCallbackData() {
    await Main.showEntryPoint(this, true)
  }

  static template = `
    <base>
      <keyboard>❓ Help, 🔁 Echo Tips</keyboard>
      <message>
        🔊 Echo Bot

        Send any message and I will repeat it back exactly as received. You can try text, photos, videos, documents, and more.
      </message>
    </base>
  `
}
