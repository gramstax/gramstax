import { PageBase } from "../base/page"
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
      <keyboard type="inline">Back</keyboard>
      <keyboard lang="en" type="inline">Back</keyboard>
      <keyboard lang="id" type="inline">Kembali</keyboard>

      <message>Help content page</message>
      <message lang="en">Help content page</message>
      <message lang="id">Bantuan konten halaman</message>
    </base>
  `
}
