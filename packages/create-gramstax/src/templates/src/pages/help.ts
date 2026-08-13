import {PageBase} from "~/base/page"
import {StartPage} from "./start"

export class HelpPage extends PageBase {
  static data = this.buildData()

  async handleCallbackQueryData() {
    await this.bdefault.show()
  }

  async handleCommandText() {
    await this.bdefault.show()
  }

  bdefault = {
    show: async () => {
      const kb = this.inlineKeyboardT([StartPage])
      await this.renderAutoRich(kb)
    }
  }

  static template = `
    <g-base>
      ${this.kbk.back()}
      <g-message>
        <b>🆘 Help Message</b>

        Use this command to get help and instructions.

        <b>🎰 Random Number</b> - Generate a random number
        <b>➕ Sum Number</b> - Add two numbers together

        <details>
          <summary>📋 More commands</summary>
          /start - Show welcome message
          /help - Show this help
          /random - Generate a random number
          /sum - Add two numbers
        </details>
      </g-message>
      <g-message lang="id">
        <b>🆘 Pesan Bantuan</b>

        Gunakan perintah ini untuk melihat bantuan dan petunjuk.

        <b>🎰 Angka Acak</b> - Menghasilkan angka secara acak
        <b>➕ Jumlah Angka</b> - Menjumlahkan dua angka

        <details>
          <summary>📋 Perintah lainnya</summary>
          /start - Tampilkan pesan selamat datang
          /help - Tampilkan bantuan ini
          /random - Hasilkan angka acak
          /sum - Jumlahkan dua angka
        </details>
      </g-message>
    </g-base>
  `
}
