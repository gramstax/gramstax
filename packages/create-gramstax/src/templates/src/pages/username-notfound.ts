import {HelpPage} from "./help"
import {PageBase} from "~/base/page"

class Base {
  static step1 = `s1`
}

class Main {
  static async showStep1Form(ctx: UserNameNotFoundPage, edit = true) {
    const bi = Base.step1
    const kb = ctx.inlineKeyboardT([HelpPage], `1`, bi)
    const da = {}
    if (edit) {
      await ctx.edit(kb, da, bi)
    } else {
      await ctx.reply(kb, da, bi)
    }
  }

  static async processStep1Answer(ctx: UserNameNotFoundPage) {
    throw ctx
  }
}

export class UserNameNotFoundPage extends PageBase {
  async showStep1Form(edit = true) {
    await Main.showStep1Form(this, edit)
  }

  static template = `
    <base id="${Base.step1}">
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
