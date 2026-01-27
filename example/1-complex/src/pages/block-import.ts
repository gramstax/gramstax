import {PageBase} from "~/base/page"
import {StartPage} from "./start"

export class BlockImportPage extends PageBase {
  async handleCallbackData() {
    const number = Math.random()
    const kb = this.inlineKeyboardT([this, StartPage])
    await this.edit(kb, {number})
  }

  static template = `
    <base>
      <import src="start" base="for-block-import" />
    </base>
  `
}
