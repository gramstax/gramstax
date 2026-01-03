import {PageBase} from "~/base/page"
import {StartPage} from "./start"

export class HelpPage extends PageBase {
  kb() {
    return this.inlineKeyboard((kb, arr) => {
      return kb.text(arr[0]!, StartPage.data.callbackData())
    })
  }

  async internal(edit = true) {
    const kb = this.kb()
    if (edit) {
      await this.edit(kb)
    } else {
      await this.reply(kb)
    }
  }

  async callback() {
    await this.internal(true)
  }

  async textCommand() {
    await this.internal(false)
  }

  static template = /*jsx*/ `
    <base>
      ${this.kbc.back()}
      <message><b>Help message</b></message>
      <message lang="it"><b>Ordina aiuto</b></message>
      <message lang="id"><b>Pesan bantuan</b></message>
    </base>
  `
}
