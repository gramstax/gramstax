import {PageBase} from "~/base/page"
import {StartPage} from "./start"

export class HelpPage extends PageBase {
  async show(edit = true) {
    const kb = this.inlineKeyboardT([StartPage])
    if (edit) await this.edit(kb)
    else await this.reply(kb)
  }

  async callback() {
    await this.show(true)
  }

  async textCommand() {
    await this.show(false)
  }

  static template = `
    <base>
      ${this.kbk.back()}
      <message><b>Help message</b></message>
      <message lang="it"><b>Ordina aiuto</b></message>
      <message lang="id"><b>Pesan bantuan</b></message>
    </base>
  `
}
