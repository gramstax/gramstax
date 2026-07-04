import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Main {
  static async showIndex(ctx: TestAudioPage) {
    const kb = ctx.inlineKeyboardT([StartPage.data.callbackData(`3`)])
    const da = {}
    await ctx.editAudio(kb, da)
  }
}

export class TestAudioPage extends PageBase {
  async handleCallbackData() {
    await Main.showIndex(this)
  }

  static template = `
    <g-base>
      ${this.kbk.back()}
      <g-media type="audio" src="https://www.w3schools.com/html/horse.ogg">
        🎧 Audio demo
        
        This is a sample audio reply with a caption.
      </g-media>
      <g-media lang="id" type="audio" src="https://www.w3schools.com/html/horse.ogg">
        🎧 Demo audio
        
        Ini adalah contoh balasan audio dengan caption.
      </g-media>
    </g-base>
  `
}
