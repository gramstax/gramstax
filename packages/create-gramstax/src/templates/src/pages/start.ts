import {HelpPage} from "./help"
import {PageBase} from "~/base/page"
import {RandomNumberPage} from "./random-number"
import {SumNumberPage} from "./sum-number"

class Base {
  static index = `-`
}

class Main {
  static async showIndex(ctx: StartPage, edit = true) {
    await ctx.clearSession()
    const bi = Base.index
    const kb = ctx.inlineKeyboardT([RandomNumberPage, SumNumberPage, HelpPage], `2`, bi)
    const da = {userName: ctx.userName}
    if (edit) {
      await ctx.edit(kb, da, bi)
    } else {
      await ctx.reply(kb, da, bi)
    }
  }
}

export class StartPage extends PageBase {
  async handleCallbackData() {
    await Main.showIndex(this, true)
  }

  async handleCommandText() {
    await Main.showIndex(this, false)
  }

  async showIndex(edit = true) {
    await Main.showIndex(this, edit)
  }

  static template = `
    <base id="${Base.index}">
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
