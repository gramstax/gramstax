import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Main {
  static async showEntryPoint(ctx: RandomNumberPage, edit = true) {
    const kb = ctx.inlineKeyboardT([this, StartPage])
    const da = {result: Math.random() * 10 ** 18}
    if (edit) {
      await ctx.edit(kb, da)
    } else {
      await ctx.reply(kb, da)
    }
  }
}

export class RandomNumberPage extends PageBase {
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
      <keyboard>🎲 Shake, ${this.kbl.back.default}</keyboard>
      <keyboard lang="id">🎲 Kocok, ${this.kbl.back.id}</keyboard>
      <message>
        <b>🎰 Random Number</b>

        {{result}}

        Generated automatically based SCALE 18.
      </message>
      <message lang="id">
        <b>🎰 Angka Acak</b>

        {{result}}

        Dihasilkan secara otomatis berdasarkan SCALE 18.
      </message>
    </base>
  `
}
