import {HelpPage} from "./help"
import {PageBase} from "~/base/page"

export class UserNameNotFoundPage extends PageBase {
  async transition(edit = true) {
    const kb = this.inlineKeyboardT([HelpPage])
    if (edit) await this.edit(kb)
    else await this.reply(kb)
  }

  static template = `
    <base>
      ${this.kbk.home()}
      <message>Please set the username first before using the bot.</message>
      <message lang="it">Prima di utilizzare il bot, imposta prima il nome utente.</message>
      <message lang="id">Tolong set username dulu sebelum memakai bot</message>
    </base>
  `
}
