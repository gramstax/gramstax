import {PageBase} from "~/base/page"
import {StartPage} from "./start"

export class BlockImportPage extends PageBase {
  kb() {
    return this.inlineKeyboard((kb, arr) => {
      return kb //
        .text(arr[0]!, this.data.callbackData())
        .row()
        .text(arr[1]!, StartPage.data.callbackData())
    })
  }

  async callback() {
    await this.edit(this.kb(), {
      number: Math.random()
    })
  }

  static template = /*jsx*/ `
    <base>
      <import src="start" base="for-block-import" />
    </base>
  `
}
