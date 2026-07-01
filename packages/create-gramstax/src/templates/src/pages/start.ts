import {HelpPage} from "./help"
import {PageBase} from "~/base/page"
import {RandomNumberPage} from "./random-number"
import {SumNumberPage} from "./sum-number"

class Base {
  static step1 = `s1`
}

class Main {
  static async showStep1Form(ctx: StartPage, edit = true) {
    await ctx.clearSession()
    const bi = Base.step1
    const kb = ctx.inlineKeyboardT([RandomNumberPage, SumNumberPage, HelpPage], `2`, bi)
    const da = {userName: ctx.userName}
    if (edit) {
      await ctx.editRich(kb, da, bi)
    } else {
      await ctx.replyRich(kb, da, bi)
    }
  }

  static async processStep1Answer(ctx: StartPage) {
    throw ctx
  }
}

export class StartPage extends PageBase {
  async handleCallbackData() {
    await Main.showStep1Form(this, true)
  }

  async handleCommandText() {
    await Main.showStep1Form(this, false)
  }

  async showStep1Form(edit = true) {
    await Main.showStep1Form(this, edit)
  }

  static template = `
    <g-base id="${Base.step1}">
      <g-keyboard>🎰 Random Number, ➕ Sum Number, 🆘 Help</g-keyboard>
      <g-keyboard lang="id">🎰 Angka Acak, ➕ Jumlah Angka, 🆘 Bantuan</g-keyboard>
      <g-message>
        <b>👋 Welcome to the bot {{userName}}</b>

        This bot was initially generated using Gramstax as the base setup and starting structure. It provides a clean foundation that can be extended with custom features, commands, and integrations as needed.

        <b>🎰 Random Number</b> - Generate a random number
        <b>➕ Sum Number</b> - Add two numbers together
        <b>❓ Help</b> - View help and available commands

        <tg-spoiler>🎁 Hidden tip: try /help for a surprise</tg-spoiler>

        <a href="https://github.com/gramstax/gramstax">📚 Documentation</a>
      </g-message>
      <g-message lang="id">
        <b>👋 Selamat datang di bot {{userName}}</b>

        Bot ini dibuat menggunakan Gramstax sebagai generator awal dan struktur dasar. Dari sini, bot dapat dikembangkan lebih lanjut dengan fitur, perintah, dan integrasi sesuai kebutuhan.

        <b>🎰 Angka Acak</b> - Menghasilkan angka secara acak
        <b>➕ Jumlah Angka</b> - Menjumlahkan dua angka
        <b>❓ Bantuan</b> - Lihat bantuan dan daftar perintah

        <tg-spoiler>🎁 Tips tersembunyi: coba /help untuk kejutan</tg-spoiler>

        <a href="https://github.com/gramstax/gramstax">📚 Dokumentasi</a>
      </g-message>
    </g-base>
  `
}
