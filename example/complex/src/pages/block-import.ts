import {PageBase} from "~/base/page"
import {StartPage} from "./start"

export class BlockImportPage extends PageBase {
  kb() {
    return this.ikb((k, a) => {
      return k //
        .text(a[0]!, this.data.callbackData())
        .row()
        .text(a[1]!, StartPage.data.callbackData())
    })
  }

  async callback() {
    await this.edit(this.kb(), {
      number: Math.random()
    })
  }

  static template = /*html*/ `
    <base>
      <import src="start" base="for-block-import" />
    </base>
  `
}
