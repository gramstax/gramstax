import { HelpPage } from "./help"
import { PageBase } from "~/base/page"

export class UserNameNotFoundPage extends PageBase {
  public kb() {
    return this.inlineKeyboard((kb, arr) => {
      return kb.text(arr[0]!, HelpPage.data.callbackData())
    })
  }

  public async transition(edit = true) {
    const kb = this.kb()
    if (edit) {
      await this.edit(kb)
    } else {
      await this.reply(kb)
    }
  }

  public static template = /*jsx*/ `
    <base>
      ${this.kbc.home()}
      <message>Please set the username first before using the bot.</message>
      <message lang="it">Prima di utilizzare il bot, imposta prima il nome utente.</message>
      <message lang="id">Tolong set username dulu sebelum memakai bot</message>
    </base>
  `
}
