import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Base {
  static step1 = `s1`
}

class Main {
  static async showStep1Form(ctx: RandomNumberPage, edit = true) {
    const bi = Base.step1
    const kb = ctx.inlineKeyboardT([ctx, StartPage], `1`, bi)
    const da = {result: Math.random() * 10 ** 18}
    if (edit) {
      await ctx.edit(kb, da, bi)
    } else {
      await ctx.reply(kb, da, bi)
    }
  }

  static async processStep1Answer(ctx: RandomNumberPage) {
    throw ctx
  }
}

export class RandomNumberPage extends PageBase {
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
      <g-keyboard>🎲 Shake, ${this.kbl.back.default}</g-keyboard>
      <g-keyboard lang="id">🎲 Kocok, ${this.kbl.back.id}</g-keyboard>
      <g-message>
        <b>🎰 Random Number</b>

        {{result}}

        Generated automatically based SCALE 18.
      </g-message>
      <g-message lang="id">
        <b>🎰 Angka Acak</b>

        {{result}}

        Dihasilkan secara otomatis berdasarkan SCALE 18.
      </g-message>
    </g-base>
  `
}
