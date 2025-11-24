import { CtxCore } from "../core/ctx"
import { StartPage } from "./start"

export class HelpPage extends CtxCore {
  public kb() {
    return this.inlineKeyboard((kb, arr) => {
      return kb.text(arr[0], StartPage.data.callbackData())
    })
  }

  public async callback() {
    const kb = this.kb()
    await this.edit(kb)
  }

  public static template = /*jsx*/ `
    <base>
      <keyboard lang="en" type="inline">Back</keyboard>
      <keyboard lang="id" type="inline">Kembali</keyboard>

      <message lang="en">
        Help content page
      </message>

      <message lang="id">
        Bantuan konten halaman
      </message>
    </base>
  `
}
