import { PageBase } from "~/base/page"
import { StartPage } from "./start"

export class HelpPage extends PageBase {
  public kb() {
    return this.inlineKeyboard((kb, arr) => {
      return kb.text(arr[0]!, StartPage.data.callbackData())
    })
  }

  public async callback() {
    await this.edit(this.kb())
  }

  public static template = /*jsx*/ `
    <base>
      ${this.KbCom.back()}
      <message>Help content page</message>
      <message lang="id">Bantuan konten halaman</message>
    </base>
  `
}
