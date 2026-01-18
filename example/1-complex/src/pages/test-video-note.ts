import {PageBase} from "~/base/page"
import {StartPage} from "./start"

export class TestVideoNotePage extends PageBase {
  async callback() {
    const kb = this.inlineKeyboardT([StartPage.data.callback(`3`)])
    await this.editVideoNote(kb)
  }

  static template = `
    <base>
      ${this.kbk.back()}
      <media type="video_note" src="https://www.w3schools.com/html/mov_bbb.mp4"></media>
      <media lang="id" type="video_note" src="https://www.w3schools.com/html/mov_bbb.mp4"></media>
    </base>
  `
}
