import {PageBase} from "~/base/page"
import {HelpPage} from "./help"
import {EchoPage} from "./echo"

class Base {
  static index = `-`
}

class Main {
  static async showIndex(ctx: StartPage, edit = true) {
    const bi = Base.index
    const kb = ctx.inlineKeyboardT([HelpPage, EchoPage], `1`, bi)
    const da = {}
    if (edit) {
      await ctx.edit(kb, da, bi)
    } else {
      await ctx.reply(kb, da, bi)
    }
  }
}

// Start page with welcome message and navigation.
export class StartPage extends PageBase {
  async handleCommandText() {
    await Main.showIndex(this, false)
  }

  async handleCallbackData() {
    await Main.showIndex(this, true)
  }

  static template = `
    <base id=${Base.index}>
      <keyboard>❓ Help, 🔁 Echo Tips</keyboard>
      <message>
        🔊 Echo Bot

        Send any message and I will repeat it back exactly as received. You can try text, photos, videos, documents, and more.
      </message>
    </base>
  `
}
