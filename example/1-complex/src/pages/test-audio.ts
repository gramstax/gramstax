import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Base {
  static index = `-`
}

class Main {
  static async showIndex(ctx: TestAudioPage) {
    const bi = Base.index
    const kb = ctx.inlineKeyboardT([StartPage.data.callbackData(`3`)], `1`, bi)
    const da = {}
    await ctx.editAudio(kb, da, bi)
  }
}

export class TestAudioPage extends PageBase {
  async handleCallbackData() {
    await Main.showIndex(this)
  }

  static template = `
    <base id="${Base.index}">
      ${this.kbk.back()}
      <media type="audio" src="https://www.w3schools.com/html/horse.ogg">
        🎧 Audio demo
        
        This is a sample audio reply with a caption.
      </media>
      <media lang="id" type="audio" src="https://www.w3schools.com/html/horse.ogg">
        🎧 Demo audio
        
        Ini adalah contoh balasan audio dengan caption.
      </media>
    </base>
  `
}
