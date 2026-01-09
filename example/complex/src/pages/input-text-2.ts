import {PageBase} from "~/base/page"
import {StartPage} from "./start"

export class InputText2Page extends PageBase {
  static data = this.buildData({
    textCommand: `input_text2`
  })

  kb(baseId?: string) {
    return this.inlineKeyboard((kb, arr) => kb.text(arr[0]!, StartPage.data.callbackData()), {baseId})
  }

  async callback() {
    await this.edit(this.kb())
  }

  async textCommand() {
    await this.reply(this.kb())
  }

  async textFree() {
    const baseId = `result`
    const data = {res: this.msgText}
    await this.reply(this.kb(baseId), data, baseId)
  }

  static template = /*jsx*/ `
    <base>
      ${this.kbc.cancel()}
      <message>Please input text you want view</message>
      <message lang="id">Tolong masukan text yang ingin anda liat</message>
    </base>
    <base id="result">
      ${this.kbc.home()}
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
