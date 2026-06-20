import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Base {
  static step1 = `s1`
  static success = `s`
}

class Helper {
  static kb(ctx: InputText2Page, baseId?: string) {
    const kb = ctx.inlineKeyboardT([StartPage], `1`, baseId)
    return kb
  }
}

class Main {
  static async showStep1Form(ctx: InputText2Page, edit = true) {
    const bi = Base.step1
    const kb = Helper.kb(ctx, bi)
    const da = {}
    if (edit) {
      await ctx.edit(kb, da, bi)
    } else {
      await ctx.reply(kb, da, bi)
    }
  }

  static async processStep1Answer(ctx: InputText2Page) {
    throw ctx
  }

  static async showSuccess(ctx: InputText2Page) {
    const bi = Base.success
    const da = {res: ctx.msgText}
    const kb = Helper.kb(ctx, bi)
    await ctx.reply(kb, da, bi)
  }
}

export class InputText2Page extends PageBase {
  static data = this.buildData({intentCommandText: `input_text2`})

  async handleCallbackData() {
    await Main.showStep1Form(this, true)
  }

  async handleCommandText() {
    await Main.showStep1Form(this, false)
  }

  async handleFreeText() {
    await Main.showSuccess(this)
  }

  static template = `
    <g-base id="${Base.step1}">
      ${this.kbk.cancel()}
      <g-message>
        📝 Input text (no session)

        Send a message to see an immediate echo response.
      </g-message>
      <g-message lang="id">
        📝 Masukkan teks (tanpa session)

        Kirim pesan untuk melihat balasan secara langsung.
      </g-message>
    </g-base>

    <g-base id="${Base.success}">
      ${this.kbk.home()}
      <g-message>
        ✅ Result (no session)

        {{res}}

        Send another text to see a different result.
      </g-message>
      <g-message lang="id">
        ✅ Hasil (tanpa session)

        {{res}}

        Kirim teks lain untuk melihat hasil yang berbeda.
      </g-message>
    </g-base>
  `
}
