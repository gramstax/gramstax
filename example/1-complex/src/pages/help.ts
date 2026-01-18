import {PageBase} from "~/base/page"
import {StartPage} from "./start"

export class HelpPage extends PageBase {
  async callback() {
    const kb = this.inlineKeyboardT([StartPage])
    await this.edit(kb)
  }

  static template = `
    <base>
      ${this.kbk.back()}
      <message>Help content page</message>
      <message lang="id">Bantuan konten halaman</message>
    </base>
  `
}
