import {PageBase} from "~/base/page"
import {StartPage} from "./start"

export class TestPhotoPage extends PageBase {
  async callback() {
    const kb = this.inlineKeyboardT([StartPage.data.callback(`3`)])
    await this.editPhoto(kb)
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
