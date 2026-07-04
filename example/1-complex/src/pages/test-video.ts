import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Main {
  static async showIndex(ctx: TestVideoPage) {
    const kb = ctx.inlineKeyboardT([StartPage.data.callbackData(`3`)])
    const da = {}
    await ctx.editVideo(kb, da)
  }
}

export class TestVideoPage extends PageBase {
  async handleCallbackData() {
    await Main.showIndex(this)
  }

  static template = `
    <g-base>
      ${this.kbk.back()}
      <g-media type="video" src="https://www.w3schools.com/html/mov_bbb.mp4">
        🎥 Video demo
        
        This is a sample video reply with a caption.
      </g-media>
      <g-media lang="id" type="video" src="https://www.w3schools.com/html/mov_bbb.mp4">
        🎥 Demo video
        
        Ini adalah contoh balasan video dengan caption.
      </g-media>
    </g-base>
  `
}
