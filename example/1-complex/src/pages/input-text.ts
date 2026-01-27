import {PageBase} from "~/base/page"
import {StartPage} from "./start"

export class InputTextPage extends PageBase {
  static data = this.buildData({intentCommandText: `input_text`})
  static BASE = {result: `result`}

  kb(baseId?: string) {
    return this.inlineKeyboardT([StartPage], `1`, baseId)
  }

  async handleCallbackData() {
    await this.sessionFreeText()
    await this.edit(this.kb())
  }

  async handleCommandText() {
    await this.sessionFreeText()
    await this.reply(this.kb())
  }

  async handleFreeText() {
    if (!this.isSessionFreeText()) return null
    const bi = InputTextPage.BASE.result
    const da = {res: this.msgText}
    await this.reply(this.kb(bi), da, bi)
  }

  static template = (() => {
    const kc = this.kbk.cancel()
    const kh = this.kbk.home()
    return `
      <base>
        ${kc}
        <message>
          ✍️ Input text (with session)

          Send any text and it will be echoed back on the next step.
        </message>
        <message lang="id">
          ✍️ Masukkan teks (dengan session)

          Kirim teks apa pun dan hasilnya akan ditampilkan pada langkah berikutnya.
        </message>
      </base>
      <base id="${this.BASE.result}">
        ${kh}
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
  })()
}
