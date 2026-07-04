import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Main {
  static async showIndex(ctx: BlockImportPage) {
    const number = Math.random()
    const kb = ctx.inlineKeyboardT([ctx, StartPage], `1`)
    const da = {number}
    await ctx.edit(kb, da)
  }
}

export class BlockImportPage extends PageBase {
  async handleCallbackData() {
    await Main.showIndex(this)
  }

  static template = `
    <g-base>
      <g-import src="start" base="for-block-import" />
    </g-base>
  `
}
