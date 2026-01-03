import {PageBase} from "~/base/page"
import {StartPage} from "./start"

export class HelpPage extends PageBase {
  kb() {
    return this.inlineKeyboard((kb, arr) => {
      return kb.text(arr[0]!, StartPage.data.callbackData())
    })
  }

  async callback() {
    await this.edit(this.kb())
  }

  static template = /*jsx*/ `
    <base>
      ${this.kbc.back()}
      <message>Help content page</message>
      <message lang="id">Bantuan konten halaman</message>
    </base>
  `
}
