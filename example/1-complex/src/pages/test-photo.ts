import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Base {
  static step1 = `s1`
}

class Main {
  static async showStep1Form(ctx: TestPhotoPage) {
    const bi = Base.step1
    const kb = ctx.inlineKeyboardT([StartPage.data.callbackData(`3`)], `1`, bi)
    const da = {}
    await ctx.editPhoto(kb, da, bi)
  }

  static async processStep1Answer(ctx: TestPhotoPage) {
    throw ctx
  }
}

export class TestPhotoPage extends PageBase {
  async handleCallbackData() {
    await Main.showStep1Form(this)
  }

  static template = `
    <base id="${Base.step1}">
      ${this.kbk.back()}
      <media type="photo" src="https://www.w3schools.com/html/img_girl.jpg">
        🖼️ Photo demo
        
        This is a sample photo media reply with a caption.
      </media>
      <media lang="id" type="photo" src="https://www.w3schools.com/html/img_girl.jpg">
        🖼️ Demo foto
        
        Ini adalah contoh balasan media foto dengan caption.
      </media>
    </base>
  `
}
