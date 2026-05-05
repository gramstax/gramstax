import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Base {
  static step1 = `s1`
}

class Main {
  static async showStep1Form(ctx: TestVoicePage) {
    const bi = Base.step1
    const kb = ctx.inlineKeyboardT([StartPage.data.callbackData(`3`)], `1`, bi)
    const da = {}
    await ctx.editVoice(kb, da, bi)
  }

  static async processStep1Answer(ctx: TestVoicePage) {
    throw ctx
  }
}

export class TestVoicePage extends PageBase {
  async handleCallbackData() {
    await Main.showStep1Form(this)
  }

  static template = `
    <base id="${Base.step1}">
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
