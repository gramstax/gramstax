import {PageBase} from "~/base/page"
import {StartPage} from "./start"

export class TestVideoNotePage extends PageBase {
  async handleCallbackData() {
    const kb = this.inlineKeyboardT([StartPage.data.callbackData(`3`)])
    await this.editVideoNote(kb)
  }

  static template = `
    <base>
      ${this.kbk.back()}
      <media type="video_note" src="https://www.w3schools.com/html/mov_bbb.mp4">
        🎬 Video note demo
        
        This is a short video note reply.
      </media>
      <media lang="id" type="video_note" src="https://www.w3schools.com/html/mov_bbb.mp4">
        🎬 Demo video note
        
        Ini adalah balasan video note singkat.
      </media>
    </base>
  `
}
