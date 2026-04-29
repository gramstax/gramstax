import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Main {
  static async showEntryPoint(ctx: TestAudioPage) {
    const kb = ctx.inlineKeyboardT([StartPage.data.callbackData(`3`)])
    await ctx.editAudio(kb)
  }
}

export class TestAudioPage extends PageBase {
  async handleCallbackData() {
    await Main.showEntryPoint(this)
  }

  static template = `
    <base>
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
