import {PageBase} from "~/base/page"
import {StartPage} from "./start"
import {SessionGuard} from "~/guards/session"

export class InputTextPage extends PageBase {
  static data = this.buildData({
    intentTextCommand: `input_text`
  })

  kb(baseId?: string) {
    return this.inlineKeyboard(
      (k, a) => {
        return k.text(a[0]!, StartPage.data.callback())
      },
      {baseId}
    )
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
    const params = await new SessionGuard(this).ensureTextFree()
    if (params === null) {
      return null
    }

    const baseId = `result`
    const data = {res: this.msgText}
    await this.reply(this.kb(baseId), data, baseId)
  }

  static template = `
    <base>
      ${this.kbk.cancel()}
      <message>Please input text you want view</message>
      <message lang="id">Tolong masukan text yang ingin anda liat</message>
    </base>
    <base id="result">
      ${this.kbk.home()}
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
}
