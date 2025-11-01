import { PageBase } from "../base/page"
import { StartPage } from "./start"

export class HelpPage extends PageBase {
  public kb() {
    return this.buildInlineKeyboard((kb, arr) => {
      return kb //
        .text(arr[0], StartPage.data.callbackData())
    })
  }

  public async internal(edit = true) {
    const kb = this.kb()
    if (edit) {
      await this.edit(kb)
    } else {
      await this.reply(kb)
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
      <keyboard lang="en" for="inline">.. Back</keyboard>
      <keyboard lang="it" for="inline">.. Ritorno</keyboard>
      <keyboard lang="id" for="inline">.. Kembali</keyboard>

      <message lang="en">
        <b>Help message</b>
      </message>

      <message lang="it">
        <b>Ordina aiuto</b>
      </message>

      <message lang="id">
        <b>Pesan bantuan</b>
      </message>
    </base>
  `
}
