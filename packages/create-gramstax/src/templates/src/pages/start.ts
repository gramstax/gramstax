import {HelpPage} from "./help"
import {PageBase} from "~/base/page"
import {RandomNumberPage} from "./random-number"

export class StartPage extends PageBase {
  async show(edit = true) {
    await this.sessionClear()
    const kb = this.inlineKeyboardT([RandomNumberPage, HelpPage], `1`)
    const data = {userName: this.userName}
    if (edit) await this.edit(kb, data)
    else await this.reply(kb, data)
  }

  async callback() {
    await this.show(true)
  }

  async textCommand() {
    await this.show(false)
  }

  static template = `
    <base>
      <keyboard>🎰 Random Number, 🆘 Help</keyboard>
      <keyboard lang="id">🎰 Angka Acak, 🆘 Bantuan</keyboard>
      <message>
        <b>👋 Welcome to the bot {{userName}}</b>

        This bot was initially generated using Gramstax as the base setup and starting structure. It provides a clean foundation that can be extended with custom features, commands, and integrations as needed.

        <b>🎰 Random Number</b> - Generate a random number
        <b>❓ Help</b> - View help and available commands
      </message>
      <message lang="id">
        <b>👋 Selamat datang di bot {{userName}}</b>

        Bot ini dibuat menggunakan Gramstax sebagai generator awal dan struktur dasar. Dari sini, bot dapat dikembangkan lebih lanjut dengan fitur, perintah, dan integrasi sesuai kebutuhan.

        <b>🎰 Angka Acak</b> - Menghasilkan angka secara acak
        <b>❓ Bantuan</b> - Lihat bantuan dan daftar perintah
      </message>
    </base>
  `
}
