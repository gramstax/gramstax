import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Perform {
  static async entryPoint(ctx: BlockImportPage) {
    const number = Math.random()
    const kb = ctx.inlineKeyboardT([this, StartPage])
    const da = {number}
    await ctx.edit(kb, da)
  }
}

export class BlockImportPage extends PageBase {
  async handleCallbackData() {
    await Perform.entryPoint(this)
  }

  static template = `
    <base>
      <import src="start" base="for-block-import" />
    </base>
  `
}
