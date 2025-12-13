import { HelpPage } from "./help"
import { PageBase } from "~/base/page"

export class StartPage extends PageBase {
  public kb() {
    return this.inlineKeyboard((kb, arr) => {
      return kb //
        .text(arr[0]!, HelpPage.data.callbackData())
    })
  }

  public async internal(edit = true) {
    const kb = this.kb()
    const data = { userName: this.userName }
    if (edit) {
      await this.edit(kb, data)
    } else {
      await this.reply(kb, data)
    }
  }

  public async callback() {
    await this.internal(true)
  }

  public async text() {
    await this.internal(false)
  }

  public async textCommand() {
    await this.internal(false)
  }

  public async textCommandPayload() {
    await this.internal(false)
  }

  public static template = /*jsx*/ `
    <base>
      <keyboard type="inline">❓ Help</keyboard>
      <keyboard lang="en" type="inline">❓ Help</keyboard>
      <keyboard lang="it" type="inline">❓ Aiuto</keyboard>
      <keyboard lang="id" type="inline">❓ Bantuan</keyboard>

      <message>
        <b>Welcome to the bot {{userName}}</b>

        <b>❓ Help</b> - View help
      </message>

      <message lang="en">
        <b>Welcome to the bot {{userName}}</b>

        <b>❓ Help</b> - View help
      </message>

      <message lang="it">
        <b>Benvenuto nel Bot di {{userName}}</b>

        <b>❓ Aiuto</b> - Ottieni assistenza e informazioni
      </message>

      <message lang="id">
        <b>Selamat datang di bot {{userName}}</b>

        <b>❓ Bantuan</b> - Lihat bantuan
      </message>
    </base>
  `
}
