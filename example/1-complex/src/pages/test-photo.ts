import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Main {
  static async showEntryPoint(ctx: TestPhotoPage) {
    const kb = ctx.inlineKeyboardT([StartPage.data.callbackData(`3`)])
    await ctx.editPhoto(kb)
  }
}

export class TestPhotoPage extends PageBase {
  async handleCallbackData() {
    await Main.showEntryPoint(this)
  }

  static template = `
    <base>
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
