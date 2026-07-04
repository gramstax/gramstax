import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Main {
  static async showIndex(ctx: TestPhotoPage) {
    const kb = ctx.inlineKeyboardT([StartPage.data.callbackData(`3`)])
    const da = {}
    await ctx.editPhoto(kb, da)
  }
}

export class TestPhotoPage extends PageBase {
  async handleCallbackData() {
    await Main.showIndex(this)
  }

  static template = `
    <g-base>
      ${this.kbk.back()}
      <g-media type="photo" src="https://www.w3schools.com/html/img_girl.jpg">
        🖼️ Photo demo
        
        This is a sample photo media reply with a caption.
      </g-media>
      <g-media lang="id" type="photo" src="https://www.w3schools.com/html/img_girl.jpg">
        🖼️ Demo foto
        
        Ini adalah contoh balasan media foto dengan caption.
      </g-media>
    </g-base>
  `
}
