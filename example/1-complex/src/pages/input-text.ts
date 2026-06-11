import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Base {
  static step1 = `s1`
  static success = `s`
}

class Helper {
  static kb(ctx: InputTextPage, baseId?: string) {
    const kb = ctx.inlineKeyboardT([StartPage], `1`, baseId)
    return kb
  }
}

class Main {
  static async showStep1Form(ctx: InputTextPage, edit = true) {
    const bi = Base.step1
    const kb = Helper.kb(ctx, bi)
    const da = {}
    await ctx.setSessionFreeText({step: bi})
    if (edit) {
      await ctx.edit(kb, da, bi)
    } else {
      await ctx.reply(kb, da, bi)
    }
  }

  static async processStep1Answer(ctx: InputTextPage) {
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
    await Main.showStep1Form(this, true)
  }

  async handleCommandText() {
    await Main.showStep1Form(this, false)
  }

  async handleSessionFreeText() {
    const {step} = this.temp.session.params
    if (step === Base.step1) {
      await Main.processStep1Answer(this)
    }
  }

  static template = `
    <base id="${Base.step1}">
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

    <base id="${Base.success}">
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
