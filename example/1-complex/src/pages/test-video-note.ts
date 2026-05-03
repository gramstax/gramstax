import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Base {
  static index = `1`
}

class Main {
  static async showIndex(ctx: TestVideoNotePage) {
    const bi = Base.index
    const kb = ctx.inlineKeyboardT([StartPage.data.callbackData(`3`)], `1`, bi)
    const da = {}
    await ctx.editVideoNote(kb, da, bi)
  }
}

export class TestVideoNotePage extends PageBase {
  async handleCallbackData() {
    await Main.showIndex(this)
  }

  static template = `
    <base id="${Base.index}">
      ${this.kbk.back()}
      <media type="video_note" src="https://www.w3schools.com/html/mov_bbb.mp4">
        🎬 Video note demo
        
        This is a short video note reply.
      </media>
      <media lang="id" type="video_note" src="https://www.w3schools.com/html/mov_bbb.mp4">
        🎬 Demo video note
        
        Ini adalah balasan video note singkat.
      </media>
    </base>
  `
}
