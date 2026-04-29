import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Main {
  static async showEntryPoint(ctx: TestVideoPage) {
    const kb = ctx.inlineKeyboardT([StartPage.data.callbackData(`3`)])
    await ctx.editVideo(kb)
  }
}

export class TestVideoPage extends PageBase {
  async handleCallbackData() {
    await Main.showEntryPoint(this)
  }

  static template = `
    <base>
      ${this.kbk.back()}
      <media type="video" src="https://www.w3schools.com/html/mov_bbb.mp4">
        🎥 Video demo
        
        This is a sample video reply with a caption.
      </media>
      <media lang="id" type="video" src="https://www.w3schools.com/html/mov_bbb.mp4">
        🎥 Demo video
        
        Ini adalah contoh balasan video dengan caption.
      </media>
    </base>
  `
}
