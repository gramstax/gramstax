import {PageBase} from "~/base/page"
import {HelpPage} from "./help"

export class UserNameNotFoundPage extends PageBase {
  static data = this.buildData()

  bdefault = {
    show: async () => {
      const kb = this.inlineKeyboardT([HelpPage])
      await this.renderAuto(kb)
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
