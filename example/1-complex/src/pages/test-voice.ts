import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Base {
  static index = `-`
}

class Main {
  static async showIndex(ctx: TestVoicePage) {
    const bi = Base.index
    const kb = ctx.inlineKeyboardT([StartPage.data.callbackData(`3`)], `1`, bi)
    const da = {}
    await ctx.editVoice(kb, da, bi)
  }
}

export class TestVoicePage extends PageBase {
  async handleCallbackData() {
    await Main.showIndex(this)
  }

  static template = `
    <base id="${Base.index}">
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
