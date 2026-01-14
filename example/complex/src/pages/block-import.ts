import {PageBase} from "~/base/page"
import {StartPage} from "./start"

export class BlockImportPage extends PageBase {
  kb() {
    return this.ikb((k, a) => {
      return k //
        .text(a[0]!, this.data.callback())
        .row()
        .text(a[1]!, StartPage.data.callback())
    })
  }

  async callback() {
    const number = Math.random()
    await this.edit(this.kb(), {number})
  }

  static template = `
    <base>
      <import src="start" base="for-block-import" />
    </base>
  `
}
