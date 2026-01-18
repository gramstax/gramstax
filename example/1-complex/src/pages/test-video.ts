import {PageBase} from "~/base/page"
import {StartPage} from "./start"

export class TestVideoPage extends PageBase {
  async callback() {
    const kb = this.inlineKeyboardT([StartPage.data.callback(`3`)])
    await this.editVideo(kb)
  }

  static template = `
    <base>
      ${this.kbk.back()}
      <media type="video" src="https://www.w3schools.com/html/mov_bbb.mp4">Caption text for media <b>video</b></media>
      <media lang="id" type="video" src="https://www.w3schools.com/html/mov_bbb.mp4">Kaption text untuk media <b>video</b></media>
    </base>
  `
}
