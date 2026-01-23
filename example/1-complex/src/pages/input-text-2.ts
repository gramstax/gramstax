import {PageBase} from "~/base/page"
import {StartPage} from "./start"

export class InputText2Page extends PageBase {
  static data = this.buildData({intentTextCommand: `input_text2`})
  static BASE = {result: `result`}

  kb(baseId?: string) {
    return this.inlineKeyboardT([StartPage], `1`, baseId)
  }

  async callback() {
    await this.edit(this.kb())
  }

  async textCommand() {
    await this.reply(this.kb())
  }

  async textFree() {
    const bi = InputText2Page.BASE.result
    const da = {res: this.msgText}
    await this.reply(this.kb(bi), da, bi)
  }

  static template = `
    <base>
      ${this.kbk.cancel()}
      <message>Please input text you want view</message>
      <message lang="id">Tolong masukan text yang ingin anda liat</message>
    </base>
    <base id="${this.BASE.result}">
      ${this.kbk.home()}
      <message>
        Result input text2 (without session): {{res}}

        Please input other text to see difference result
      </message>
      <message lang="id">
        Hasil masukan text2 (tanpa session): {{res}}

        Tolong masukan text lain untuk lihat hasil yang berbeda
      </message>
    </base>
  `
}
