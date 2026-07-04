import {HelpPage} from "./help"
import {PageBase} from "~/base/page"

class Main {
  static async showIndex(ctx: UserNameNotFoundPage, edit = true) {
    const kb = ctx.inlineKeyboardT([HelpPage])
    const da = {}
    if (edit) {
      await ctx.edit(kb, da)
    } else {
      await ctx.reply(kb, da)
    }
  }
}

export class UserNameNotFoundPage extends PageBase {
  async showIndex(edit = true) {
    await Main.showIndex(this, edit)
  }

  static template = `
    <g-base>
      ${this.kbk.home()}
      <g-message>
        <b>⚠️ Username Required</b>

        Please set the username first before using the bot.
      </g-message>
      <g-message lang="id">
        <b>⚠️ Username Diperlukan</b>

        Tolong set username dulu sebelum memakai bot.
      </g-message>
    </g-base>
  `
}
