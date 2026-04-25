import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Perform {
  static async entryPoint(ctx: TestVoicePage) {
    const kb = ctx.inlineKeyboardT([StartPage.data.callbackData(`3`)])
    await ctx.editVoice(kb)
  }
}

export class TestVoicePage extends PageBase {
  async handleCallbackData() {
    await Perform.entryPoint(this)
  }

  static template = `
    <base>
      ${this.kbk.back()}
      <media type="voice" src="https://www.w3schools.com/html/horse.ogg">
        🎙️ Voice demo
        
        This is a voice reply without a caption attachment.
      </media>
      <media lang="id" type="voice" src="https://www.w3schools.com/html/horse.ogg">
        🎙️ Demo voice
        
        Ini adalah balasan voice tanpa lampiran caption.
      </media>
    </base>
  `
}
