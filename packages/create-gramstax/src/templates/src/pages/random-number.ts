import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Base {
  static index = `-`
}

class Main {
  static async showIndex(ctx: RandomNumberPage, edit = true) {
    const bi = Base.index
    const kb = ctx.inlineKeyboardT([ctx, StartPage], `1`, bi)
    const da = {result: Math.random() * 10 ** 18}
    if (edit) {
      await ctx.edit(kb, da, bi)
    } else {
      await ctx.reply(kb, da, bi)
    }
  }
}

export class RandomNumberPage extends PageBase {
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
