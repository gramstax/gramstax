import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Base {
  static step1 = `s1`
}

class Main {
  static async showStep1Form(ctx: TestAudioPage) {
    const bi = Base.step1
    const kb = ctx.inlineKeyboardT([StartPage.data.callbackData(`3`)], `1`, bi)
    const da = {}
    await ctx.editAudio(kb, da, bi)
  }

  static async processStep1Answer(ctx: TestAudioPage) {
    throw ctx
  }
}

export class TestAudioPage extends PageBase {
  async handleCallbackData() {
    await Main.showStep1Form(this)
  }

  static template = `
    <base id="${Base.step1}">
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
