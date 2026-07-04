import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Main {
  static async showIndex(ctx: TestStickerPage) {
    const kb = ctx.inlineKeyboardT([StartPage.data.callbackData(`3`)])
    const da = {}
    await ctx.editSticker(kb, da)
  }
}

export class TestStickerPage extends PageBase {
  async handleCallbackData() {
    await Main.showIndex(this)
  }

  static template = `
    <g-base>
      ${this.kbk.back()}
      <g-media type="sticker" src="https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExdzkwMDVreGl2d3o4aTkzNnp4cXprcmNsZDZpdTFnZnpiNjl3MXZrYSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/OODdDyv4DwkNNTpMWS/giphy.gif">
        😀 Sticker demo
        
        This shows a sticker reply.
      </g-media>
      <g-media lang="id" type="sticker" src="https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExdzkwMDVreGl2d3o4aTkzNnp4cXprcmNsZDZpdTFnZnpiNjl3MXZrYSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/OODdDyv4DwkNNTpMWS/giphy.gif">
        😀 Demo stiker
        
        Ini menunjukkan balasan stiker.
      </g-media>
    </g-base>
  `
}
