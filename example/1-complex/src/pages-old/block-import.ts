import {PageBase} from "~/base/page"
import {StartPage} from "./start"

export class BlockImportPage extends PageBase {
  async handleCallbackQueryData() {
    await this.bdefault.show()
  }

  bdefault = {
    show: async () => {
      const kb = this.inlineKeyboardT([this, StartPage], `1`)
      const da = {number: Math.random()}
      await this.renderEdit(kb, da)
    }
  }

  static template = `
    <g-base>
      <g-import src="start" base="for-block-import" />
    </g-base>
  `
}
