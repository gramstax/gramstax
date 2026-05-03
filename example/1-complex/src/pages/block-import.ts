import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Base {
  static index = `-`
}

class Main {
  static async showIndex(ctx: BlockImportPage) {
    const number = Math.random()
    const bi = Base.index
    const kb = ctx.inlineKeyboardT([ctx, StartPage], `1`, bi)
    const da = {number}
    await ctx.edit(kb, da, bi)
  }
}

export class BlockImportPage extends PageBase {
  async handleCallbackData() {
    await Main.showIndex(this)
  }

  static template = `
    <base id="${Base.index}">
      <import src="start" base="for-block-import" />
    </base>
  `
}
