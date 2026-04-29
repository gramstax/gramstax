import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Base {
  static success: `success`
}

class Helper {
  static kb(ctx: InputText2Page, baseId?: string) {
    return ctx.inlineKeyboardT([StartPage], `1`, baseId)
  }
}

class Main {
  static async showEntryPoint(ctx: InputText2Page, edit = true) {
    const kb = Helper.kb(ctx)
    if (edit) {
      await ctx.edit(kb)
    } else {
      await ctx.reply(kb)
    }
  }
}

class Alert {
  static async success(ctx: InputText2Page) {
    const bi = Base.success
    const da = {res: ctx.msgText}
    const kb = Helper.kb(ctx, bi)
    await ctx.reply(kb, da, bi)
  }
}

export class InputText2Page extends PageBase {
  static data = this.buildData({intentCommandText: `input_text2`})

  async handleCallbackData() {
    await Main.showEntryPoint(this, true)
  }

  async handleCommandText() {
    await Main.showEntryPoint(this, false)
  }

  async handleFreeText() {
    await Alert.success(this)
  }

  static template = `
    <base>
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
