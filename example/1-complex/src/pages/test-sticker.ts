import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Base {
  static step1 = `s1`
}

class Main {
  static async showStep1Form(ctx: TestStickerPage) {
    const bi = Base.step1
    const kb = ctx.inlineKeyboardT([StartPage.data.callbackData(`3`)], `1`, bi)
    const da = {}
    await ctx.editSticker(kb, da, bi)
  }

  static async processStep1Answer(ctx: TestStickerPage) {
    throw ctx
  }
}

export class TestStickerPage extends PageBase {
  async handleCallbackData() {
    await Main.showStep1Form(this)
  }

  static template = `
    <base id="${Base.step1}">
      ${this.kbk.back()}
      <media type="sticker" src="https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExdzkwMDVreGl2d3o4aTkzNnp4cXprcmNsZDZpdTFnZnpiNjl3MXZrYSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/OODdDyv4DwkNNTpMWS/giphy.gif">
        😀 Sticker demo
        
        This shows a sticker reply.
      </media>
      <media lang="id" type="sticker" src="https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExdzkwMDVreGl2d3o4aTkzNnp4cXprcmNsZDZpdTFnZnpiNjl3MXZrYSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/OODdDyv4DwkNNTpMWS/giphy.gif">
        😀 Demo stiker
        
        Ini menunjukkan balasan stiker.
      </media>
    </base>
  `
}
