import {HelpPage} from "./help"
import {PageBase} from "~/base/page"

export class UserNameNotFoundPage extends PageBase {
  bdefault = {
    show: async (isEdit = true) => {
      const kb = this.inlineKeyboardT([HelpPage])
      if (isEdit) {
        await this.edit(kb, {})
      } else {
        await this.reply(kb, {})
      }
    }
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
