import {HelpPage} from "./help"
import {PageBase} from "~/base/page"

class Main {
  static async showEntryPoint(ctx: UserNameNotFoundPage, edit = true) {
    const kb = ctx.inlineKeyboardT([HelpPage])
    if (edit) {
      await ctx.edit(kb)
    } else {
      await ctx.reply(kb)
    }
  }
}

export class UserNameNotFoundPage extends PageBase {
  async showEntryPoint(edit = true) {
    await Main.showEntryPoint(this, edit)
  }

  static template = `
    <base>
      ${this.kbk.home()}
      <message>
        <b>⚠️ Username Required</b>

        Please set the username first before using the bot.
      </message>
      <message lang="id">
        <b>⚠️ Username Diperlukan</b>

        Tolong set username dulu sebelum memakai bot.
      </message>
    </base>
  `
}
