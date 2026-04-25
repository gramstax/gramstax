import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Perform {
  static async entryPoint(ctx: RandomNumberPage, edit = true) {
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
    await Perform.entryPoint(this, true)
  }

  async handleCommandText() {
    await Perform.entryPoint(this, false)
  }

  async entryPoint(edit = true) {
    await Perform.entryPoint(this, edit)
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
