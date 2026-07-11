import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Base {
  static index = `i`
  static success = `s`
}

class Helper {
  static kb(ctx: InputTextPage, AGBaseId?: string) {
    const kb = ctx.inlineKeyboardT([StartPage], `1`, AGBaseId)
    return kb
  }
}

class Main {
  static async showIndex(ctx: InputTextPage, edit = true) {
    const bi = Base.index
    const kb = Helper.kb(ctx, bi)
    const da = {}
    await ctx.setSessionFreeText({step: bi})
    if (edit) {
      await ctx.edit(kb, da, bi)
    } else {
      await ctx.reply(kb, da, bi)
    }
  }

  static async processIndex(ctx: InputTextPage) {
    await Main.showSuccess(ctx)
  }

  static async showSuccess(ctx: InputTextPage) {
    const bi = Base.success
    const da = {res: ctx.msgText}
    const kb = Helper.kb(ctx, bi)
    await ctx.reply(kb, da, bi)
  }
}

export class InputTextPage extends PageBase {
  static data = this.buildData({intentCommandText: `input_text`})

  async handleCallbackData() {
    await Main.showIndex(this, true)
  }

  async handleCommandText() {
    await Main.showIndex(this, false)
  }

  async handleSessionFreeText() {
    const {step} = this.temp.session.params
    if (step === Base.index) {
      await Main.processIndex(this)
    }
  }

  static template = `
    <g-base id="${Base.index}">
      ${this.kbk.cancel()}
      <g-message>
        ✍️ Input text (with session)

        Send any text and it will be echoed back on the next step.
      </g-message>
      <g-message lang="id">
        ✍️ Masukkan teks (dengan session)

        Kirim teks apa pun dan hasilnya akan ditampilkan pada langkah berikutnya.
      </g-message>
    </g-base>

    <g-base id="${Base.success}">
      ${this.kbk.home()}
      <g-message>
        ✅ Result

        {{res}}

        Send another text to compare results.
      </g-message>
      <g-message lang="id">
        ✅ Hasil

        {{res}}

        Kirim teks lain untuk melihat hasil yang berbeda.
      </g-message>
    </g-base>
    `
}
