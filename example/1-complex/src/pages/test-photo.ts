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
      <media type="photo" src="https://www.w3schools.com/html/img_girl.jpg">Caption text for media <b>photo</b></media>
      <media lang="id" type="photo" src="https://www.w3schools.com/html/img_girl.jpg">Kaption text untuk media <b>foto</b></media>
    </base>
  `
}
