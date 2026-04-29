import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Main {
  static async showEntryPoint(ctx: BlockImportPage) {
    const number = Math.random()
    const kb = ctx.inlineKeyboardT([this, StartPage])
    const da = {number}
    await ctx.edit(kb, da)
  }
}

export class BlockImportPage extends PageBase {
  async handleCallbackData() {
    await Main.showEntryPoint(this)
  }

  static template = `
    <base>
      <import src="start" base="for-block-import" />
    </base>
  `
}
