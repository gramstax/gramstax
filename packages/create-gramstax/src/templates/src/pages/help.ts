import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Base {
  static step1 = `s1`
}

class Main {
  static async showStep1Form(ctx: HelpPage, edit = true) {
    const bi = Base.step1
    const kb = ctx.inlineKeyboardT([StartPage], `1`, bi)
    const da = {}
    if (edit) {
      await ctx.edit(kb, da, bi)
    } else {
      await ctx.reply(kb, da, bi)
    }
  }

  static async processStep1Answer(ctx: HelpPage) {
    throw ctx
  }
}

export class HelpPage extends PageBase {
  async handleCallbackData() {
    await Main.showStep1Form(this, true)
  }

  async handleCommandText() {
    await Main.showStep1Form(this, false)
  }

  static template = `
    <base id="${Base.step1}">
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
