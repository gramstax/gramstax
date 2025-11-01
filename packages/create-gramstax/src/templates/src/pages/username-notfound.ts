import { HelpPage } from "./help"
import { PageBase } from "../base/page"

export class UserNameNotFoundPage extends PageBase {
  public kb() {
    return this.buildInlineKeyboard((kb, arr) => {
      return kb //
        .text(arr[0], HelpPage.data.callbackData())
    })
  }

  public async transition(edit = true) {
    const kb = this.kb()
    const data = { username: this.ctx.username }
    if (edit) {
      await this.edit(kb, data)
    } else {
      await this.reply(kb, data)
    }
  }

  public static template = /*jsx*/ `
    <base>
      <keyboard lang="en" for="inline">.. Home</keyboard>
      <keyboard lang="es" for="inline">.. Inicio</keyboard>
      <keyboard lang="id" for="inline">.. Beranda</keyboard>

      <message lang="en">
        Please set the username first before using the bot.
      </message>

      <message lang="it">
        Prima di utilizzare il bot, imposta prima il nome utente.
      </message>

      <message lang="id">
        Tolong set username dulu sebelum memakai bot
      </message>
    </base>
  `
}
