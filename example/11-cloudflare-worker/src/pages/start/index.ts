import {PageBase} from "~/base/page"
import {HelpPage} from "../help"
import {SumNumberPage} from "../sum-number"
import {StartRandomPage} from "./random"

export class StartPage extends PageBase {
  static data = this.buildData()

  async handleCallbackQueryData() {
    await this.gdefault.show()
  }

  async handleCommandText() {
    await this.gdefault.show()
  }

  helper = {}
  gdefault = {
    show: async () => {
      await this.clearSession()
      const kb = this.inlineKeyboardT([StartRandomPage, SumNumberPage, HelpPage], `2`)
      const da = {userName: this.from?.username}
      await this.renderAutoRich(kb, da)
    },
    process: () => {}
  }

  static template = `
    <g-base>
      <g-keyboard type="inline">🎲 Random, ➕ Sum Number, 🆘 Help</g-keyboard>
      <g-keyboard type="inline" lang="id">🎲 Acak, ➕ Jumlah Angka, 🆘 Bantuan</g-keyboard>
      <g-message>
        <b>👋 Welcome to the bot {{userName}}</b>

        This bot was initially generated using Gramstax as the base setup and starting structure. It provides a clean foundation that can be extended with custom features, commands, and integrations as needed.

        <b>🎲 Random</b> - Generate random numbers or text
        <b>➕ Sum Number</b> - Add two numbers together
        <b>❓ Help</b> - View help and available commands

        <tg-spoiler>🎁 Hidden tip: try /help for a surprise</tg-spoiler>

        <a href="https://github.com/gramstax/gramstax">📚 Documentation</a>
      </g-message>
      <g-message lang="id">
        <b>👋 Selamat datang di bot {{userName}}</b>

        Bot ini dibuat menggunakan Gramstax sebagai generator awal dan struktur dasar. Dari sini, bot dapat dikembangkan lebih lanjut dengan fitur, perintah, dan integrasi sesuai kebutuhan.

        <b>🎲 Acak</b> - Hasilkan angka atau teks acak
        <b>➕ Jumlah Angka</b> - Menjumlahkan dua angka
        <b>❓ Bantuan</b> - Lihat bantuan dan daftar perintah

        <tg-spoiler>🎁 Tips tersembunyi: coba /help untuk kejutan</tg-spoiler>

        <a href="https://github.com/gramstax/gramstax">📚 Dokumentasi</a>
      </g-message>
    </g-base>
  `
}
