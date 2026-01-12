import {HelpPage} from "./help"
import {PageBase} from "~/base/page"

export class UserNameNotFoundPage extends PageBase {
  kb() {
    return this.ikb((k, a) => {
      return k.text(a[0]!, HelpPage.data.callbackData())
    })
  }

  async transition(edit = true) {
    const kb = this.kb()
    if (edit) {
      await this.edit(kb)
    } else {
      await this.reply(kb)
    }
  }

  static template = /*html*/ `
    <base>
      ${this.kbc.home()}
      <message>Please set the username first before using the bot.</message>
      <message lang="it">Prima di utilizzare il bot, imposta prima il nome utente.</message>
      <message lang="id">Tolong set username dulu sebelum memakai bot</message>
    </base>
  `
}
