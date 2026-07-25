import {PageBase} from "~/base/page"
import {StartPage} from "~/pages/start"

export class StartTestStickerPage extends PageBase {
  async handleCallbackQueryData() {
    await this.bdefault.show()
  }

  bdefault = {
    show: async () => {
      const kb = this.inlineKeyboardT([StartPage.data.callbackQueryData(`3`)])
      await this.renderEditSticker(kb)
    }
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
