import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Base {
  static step1 = `s1`
}

class Main {
  static async showStep1Form(ctx: BlockImportPage) {
    const number = Math.random()
    const bi = Base.step1
    const kb = ctx.inlineKeyboardT([ctx, StartPage], `1`, bi)
    const da = {number}
    await ctx.edit(kb, da, bi)
  }

  static async processStep1Answer(ctx: BlockImportPage) {
    throw ctx
  }
}

export class BlockImportPage extends PageBase {
  async handleCallbackData() {
    await Main.showStep1Form(this)
  }

  static template = `
    <g-base id="${Base.step1}">
      <g-import src="start" base="for-block-import" />
    </g-base>
  `
}
