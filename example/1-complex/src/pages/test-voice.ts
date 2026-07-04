import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Main {
  static async showIndex(ctx: TestVoicePage) {
    const kb = ctx.inlineKeyboardT([StartPage.data.callbackData(`3`)])
    const da = {}
    await ctx.editVoice(kb, da)
  }
}

export class TestVoicePage extends PageBase {
  async handleCallbackData() {
    await Main.showIndex(this)
  }

  static template = `
    <g-base>
      ${this.kbk.back()}
      <g-media type="voice" src="https://www.w3schools.com/html/horse.ogg">
        🎙️ Voice demo
        
        This is a voice reply without a caption attachment.
      </g-media>
      <g-media lang="id" type="voice" src="https://www.w3schools.com/html/horse.ogg">
        🎙️ Demo voice
        
        Ini adalah balasan voice tanpa lampiran caption.
      </g-media>
    </g-base>
  `
}
