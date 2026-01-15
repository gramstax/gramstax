import {PageBase} from "~/base/page"
import {StartPage} from "./start"

export class TestVideoNotePage extends PageBase {
  kb() {
    return this.ikb((k, a) => {
      return k.text(a[0]!, StartPage.data.callback(`3`))
    })
  }

  async callback() {
    await this.editVideoNote(this.kb())
  }

  static template = `
    <base>
      ${this.kbk.back()}
      <media type="video_note" src="https://www.w3schools.com/html/mov_bbb.mp4"></media>
      <media lang="id" type="video_note" src="https://www.w3schools.com/html/mov_bbb.mp4"></media>
    </base>
  `
}
