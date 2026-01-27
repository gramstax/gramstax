import {PageBase} from "~/base/page"
import {StartPage} from "./start"

export class HelpPage extends PageBase {
  async show(edit = true) {
    const kb = this.inlineKeyboardT([StartPage])
    if (edit) await this.edit(kb)
    else await this.reply(kb)
  }

  async handleCallbackData() {
    await this.show(true)
  }

  async handleCommandText() {
    await this.show(false)
  }

  static template = `
    <base>
      ${this.kbk.back()}
      <message>
        <b>🆘 Help Message</b>

        Use this command to get help and instructions.

        <b>🎰 Random Number</b> - Generate a random number
        <b>➕ Sum Number</b> - Add two numbers together
      </message>
      <message lang="id">
        <b>🆘 Pesan Bantuan</b>

        Gunakan perintah ini untuk melihat bantuan dan petunjuk.

        <b>🎰 Angka Acak</b> - Menghasilkan angka secara acak
        <b>➕ Jumlah Angka</b> - Menjumlahkan dua angka
      </message>
    </base>
  `
}
