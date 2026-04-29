import {HelpPage} from "./help"
import {PageBase} from "~/base/page"
import {RandomNumberPage} from "./random-number"
import {SumNumberPage} from "./sum-number"

class Main {
  static async showEntryPoint(ctx: StartPage, edit = true) {
    await ctx.clearSession()
    const kb = ctx.inlineKeyboardT([RandomNumberPage, SumNumberPage, HelpPage], `2`)
    const da = {userName: ctx.userName}
    if (edit) {
      await ctx.edit(kb, da)
    } else {
      await ctx.reply(kb, da)
    }
  }
}

export class StartPage extends PageBase {
  async handleCallbackData() {
    await Main.showEntryPoint(this, true)
  }

  async handleCommandText() {
    await Main.showEntryPoint(this, false)
  }

  async entryPoint(edit = true) {
    await Main.showEntryPoint(this, edit)
  }

  static template = `
    <base>
      <keyboard>🎰 Random Number, ➕ Sum Number, 🆘 Help</keyboard>
      <keyboard lang="id">🎰 Angka Acak, ➕ Jumlah Angka, 🆘 Bantuan</keyboard>
      <message>
        <b>👋 Welcome to the bot {{userName}}</b>

        This bot was initially generated using Gramstax as the base setup and starting structure. It provides a clean foundation that can be extended with custom features, commands, and integrations as needed.

        <b>🎰 Random Number</b> - Generate a random number
        <b>➕ Sum Number</b> - Add two numbers together
        <b>❓ Help</b> - View help and available commands
      </message>
      <message lang="id">
        <b>👋 Selamat datang di bot {{userName}}</b>

        Bot ini dibuat menggunakan Gramstax sebagai generator awal dan struktur dasar. Dari sini, bot dapat dikembangkan lebih lanjut dengan fitur, perintah, dan integrasi sesuai kebutuhan.

        <b>🎰 Angka Acak</b> - Menghasilkan angka secara acak
        <b>➕ Jumlah Angka</b> - Menjumlahkan dua angka
        <b>❓ Bantuan</b> - Lihat bantuan dan daftar perintah
      </message>
    </base>
  `
}
