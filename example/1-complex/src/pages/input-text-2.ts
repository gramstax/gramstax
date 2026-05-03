import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Base {
  static index = `-`
  static success = `success`
}

class Helper {
  static kb(ctx: InputText2Page, baseId?: string) {
    return ctx.inlineKeyboardT([StartPage], `1`, baseId)
  }
}

class Alert {
  static async showSuccess(ctx: InputText2Page) {
    const bi = Base.success
    const da = {res: ctx.msgText}
    const kb = Helper.kb(ctx, bi)
    await ctx.reply(kb, da, bi)
  }
}

class Main {
  static async showIndex(ctx: InputText2Page, edit = true) {
    const bi = Base.index
    const kb = Helper.kb(ctx)
    const da = {}
    if (edit) {
      await ctx.edit(kb, da, bi)
    } else {
      await ctx.reply(kb, da, bi)
    }
  }
}

export class InputText2Page extends PageBase {
  static data = this.buildData({intentCommandText: `input_text2`})

  async handleCallbackData() {
    await Main.showIndex(this, true)
  }

  async handleCommandText() {
    await Main.showIndex(this, false)
  }

  async handleFreeText() {
    await Alert.showSuccess(this)
  }

  static template = `
    <base id="${Base.index}">
      ${this.kbk.cancel()}
      <message>
        📝 Input text (no session)

        Send a message to see an immediate echo response.
      </message>
      <message lang="id">
        📝 Masukkan teks (tanpa session)

        Kirim pesan untuk melihat balasan secara langsung.
      </message>
    </base>

    <base id="${Base.success}">
      ${this.kbk.home()}
      <message>
        ✅ Result (no session)

        {{res}}

        Send another text to see a different result.
      </message>
      <message lang="id">
        ✅ Hasil (tanpa session)

        {{res}}

        Kirim teks lain untuk melihat hasil yang berbeda.
      </message>
    </base>
  `
}
