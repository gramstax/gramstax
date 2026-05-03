import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Base {
  static index = `1`
}

class Main {
  static async showIndex(ctx: TestVideoPage) {
    const bi = `i`
    const kb = ctx.inlineKeyboardT([StartPage.data.callbackData(`3`)], `1`, bi)
    const da = {}
    await ctx.editVideo(kb, da, bi)
  }
}

export class TestVideoPage extends PageBase {
  async handleCallbackData() {
    await Main.showIndex(this)
  }

  static template = `
    <base id="${Base.index}">
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
