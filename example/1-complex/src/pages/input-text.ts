import {PageBase} from "~/base/page"
import {StartPage} from "./start"

export class InputTextPage extends PageBase {
  static data = this.buildData({
    intentTextCommand: `input_text`
  })

  kb(baseId?: string) {
    return this.inlineKeyboardT([StartPage], `1`, baseId)
  }

  async callback() {
    await this.sessionToTextFree()
    await this.edit(this.kb())
  }

  async textCommand() {
    await this.sessionToTextFree()
    await this.reply(this.kb())
  }

  async textFree() {
    if (!this.validateSessionTextFree()) return null
    const bi = `result`
    const da = {res: this.msgText}
    await this.reply(this.kb(bi), da, bi)
  }

  static template = (() => {
    const kc = this.kbk.cancel()
    const kh = this.kbk.home()
    return `
      <base>
        ${kc}
        <message>Please input text you want view</message>
        <message lang="id">Tolong masukan text yang ingin anda liat</message>
      </base>
      <base id="result">
        ${kh}
        <message>
          Result: {{res}}

          Please input other text to see difference result
        </message>
        <message lang="id">
          Hasil: {{res}}

          Tolong masukan text lain untuk lihat hasil yang berbeda
        </message>
      </base>
    `
  })()
}
