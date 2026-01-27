import {PageBase} from "~/base/page"
import {StartPage} from "./start"

export class InputText2Page extends PageBase {
  static data = this.buildData({intentCommandText: `input_text2`})
  static BASE = {result: `result`}

  kb(baseId?: string) {
    return this.inlineKeyboardT([StartPage], `1`, baseId)
  }

  async handleCallbackData() {
    await this.edit(this.kb())
  }

  async handleCommandText() {
    await this.reply(this.kb())
  }

  async handleFreeText() {
    // if (!this.isSessionFreeText()) return null
    const bi = InputText2Page.BASE.result
    const da = {res: this.msgText}
    await this.reply(this.kb(bi), da, bi)
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
    <base id="${this.BASE.result}">
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
