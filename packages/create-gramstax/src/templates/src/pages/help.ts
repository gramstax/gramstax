import {PageBase} from "~/base/page"
import {StartPage} from "./start"

export class HelpPage extends PageBase {
  kb() {
    return this.inlineKeyboard((k, a) => {
      return k.text(a[0]!, StartPage.data.callback())
    })
  }

  async core(edit = true) {
    const kb = this.kb()
    if (edit) await this.edit(kb)
    else await this.reply(kb)
  }

  async callback() {
    await this.core(true)
  }

  async textCommand() {
    await this.core(false)
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
