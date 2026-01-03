import {PageBase} from "~/base/page"
import {StartPage} from "./start"

export class GeneralErrorInputNotFoundPage extends PageBase {
  kb() {
    return this.inlineKeyboard((kb, arr) => {
      return kb.text(arr[0]!, StartPage.data.callbackData())
    })
  }

  async transition() {
    await this.edit(this.kb())
  }

  static template = /*jsx*/ `
    <base>
      ${this.kbc.home()}
      <message><b>❌ Not Found</b></message>
      <message lang="it"><b>❌ Non Trovato</b></message>
      <message lang="id"><b>❌ Tidak Ditemukan</b></message>
    </base>
  `
}
