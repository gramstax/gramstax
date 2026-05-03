import {HelpPage} from "./help"
import {PageBase} from "~/base/page"

class Base {
  static index = `-`
}

class Main {
  static async showIndex(ctx: UserNameNotFoundPage, edit = true) {
    const bi = Base.index
    const kb = ctx.inlineKeyboardT([HelpPage], `1`, bi)
    const da = {}
    if (edit) {
      await ctx.edit(kb, da, bi)
    } else {
      await ctx.reply(kb, da, bi)
    }
  }
}

export class UserNameNotFoundPage extends PageBase {
  async showIndex(edit = true) {
    await Main.showIndex(this, edit)
  }

  static template = `
    <base id="${Base.index}">
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
