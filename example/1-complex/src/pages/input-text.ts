import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Base {
  static result: `result`
}

class Helper {
  static kb(ctx: InputTextPage, baseId?: string) {
    return ctx.inlineKeyboardT([StartPage], `1`, baseId)
  }
}

class Flow {
  static async step1Form(ctx: InputTextPage, edit = true) {
    await ctx.sessionFreeText()
    const kb = Helper.kb(ctx)
    if (edit) {
      await ctx.edit(kb)
    } else {
      await ctx.reply(kb)
    }
  }

  static async step1Answer(ctx: InputTextPage) {
    const bi = Base.result
    const da = {res: ctx.msgText}
    const kb = Helper.kb(ctx, bi)
    await ctx.reply(kb, da, bi)
  }
}

export class InputTextPage extends PageBase {
  static data = this.buildData({intentCommandText: `input_text`})

  async handleCallbackData() {
    await Flow.step1Form(this, true)
  }

  async handleCommandText() {
    await Flow.step1Form(this, false)
  }

  async handleFreeText() {
    if (!this.isSessionFreeText()) {
      return null
    }
    await Flow.step1Answer(this)
  }

  static template = `
    <base>
      ${this.kbk.cancel()}
      <message>
        ✍️ Input text (with session)

        Send any text and it will be echoed back on the next step.
      </message>
      <message lang="id">
        ✍️ Masukkan teks (dengan session)

        Kirim teks apa pun dan hasilnya akan ditampilkan pada langkah berikutnya.
      </message>
    </base>

    <base id="${Base.result}">
      ${this.kbk.home()}
      <message>
        ✅ Result

        {{res}}

        Send another text to compare results.
      </message>
      <message lang="id">
        ✅ Hasil

        {{res}}

        Kirim teks lain untuk melihat hasil yang berbeda.
      </message>
    </base>
    `
}
