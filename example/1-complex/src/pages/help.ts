import {PageBase} from "~/base/page"
import {StartPage} from "./start"

export class HelpPage extends PageBase {
  kb() {
    return this.inlineKeyboard((k, a) => {
      return k.text(a[0]!, StartPage.data.callback())
    })
  }

  async callback() {
    await this.edit(this.kb())
  }

  static template = `
    <base>
      ${this.kbk.back()}
      <message>Help content page</message>
      <message lang="id">Bantuan konten halaman</message>
    </base>
  `
}
