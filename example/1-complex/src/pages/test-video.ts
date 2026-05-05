import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Base {
  static step1 = `s1`
}

class Main {
  static async showStep1Form(ctx: TestVideoPage) {
    const bi = `i`
    const kb = ctx.inlineKeyboardT([StartPage.data.callbackData(`3`)], `1`, bi)
    const da = {}
    await ctx.editVideo(kb, da, bi)
  }

  static async processStep1Answer(ctx: TestVideoPage) {
    throw ctx
  }
}

export class TestVideoPage extends PageBase {
  async handleCallbackData() {
    await Main.showStep1Form(this)
  }

  static template = `
    <base id="${Base.step1}">
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
