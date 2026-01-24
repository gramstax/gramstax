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
      <message>
        <b>🆘 Help Message</b>

        Use this command to get help and instructions.
      </message>
      <message lang="id">
        <b>🆘 Pesan Bantuan</b>

        Gunakan perintah ini untuk melihat bantuan dan petunjuk.
      </message>
    </base>
  `
}
