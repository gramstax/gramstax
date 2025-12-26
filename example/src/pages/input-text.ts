import { PageBase } from "~/base/page"
import { StartPage } from "./start"

export class InputTextPage extends PageBase {
  public kb(baseId?: string) {
    return this.inlineKeyboard(
      (kb, arr) => {
        return kb.text(arr[0]!, StartPage.data.callbackData())
      },
      { baseId }
    )
  }

  public async callback() {
    await this.sessionToTextFree()
    await this.edit(this.kb())
  }

  public async textFree() {
    const baseId = `result`
    const data = { res: this.msgText }
    await this.reply(this.kb(baseId), data, baseId)
  }

  public static template = /*jsx*/ `
    <base id="result">  
      <import src="start" base="ikb-home" />

      <message>
        Result: {{res}}

        Please input other text to see difference result
      </message>

      <message lang="id">
        Hasil: {{res}}

        Tolong masukan text lain untuk lihat hasil yang berbeda
      </message>
    </base>

    <base>
      <import src="start" base="ikb-cancel" />

      <message>Please input text you want view</message>
      <message lang="id">Tolong masukan text yang ingin anda liat</message>
    </base>
  `
}
