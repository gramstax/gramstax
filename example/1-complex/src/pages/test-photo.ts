import {PageBase} from "~/base/page"
import {StartPage} from "./start"

export class TestPhotoPage extends PageBase {
  async handleCallbackData() {
    await this.bdefault.show()
  }

  bdefault = {
    show: async () => {
      const kb = this.inlineKeyboardT([StartPage.data.callbackData(`3`)])
      await this.editPhoto(kb)
    }
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
