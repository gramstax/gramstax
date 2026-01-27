import {PageBase} from "~/base/page"
import {StartPage} from "./start"

export class TestVideoPage extends PageBase {
  async handleCallbackData() {
    const kb = this.inlineKeyboardT([StartPage.data.callbackData(`3`)])
    await this.editVideo(kb)
  }

  static template = `
    <base>
      ${this.kbk.back()}
      <media type="video" src="https://www.w3schools.com/html/mov_bbb.mp4">
        🎥 Video demo
        
        This is a sample video reply with a caption.
      </media>
      <media lang="id" type="video" src="https://www.w3schools.com/html/mov_bbb.mp4">
        🎥 Demo video
        
        Ini adalah contoh balasan video dengan caption.
      </media>
    </base>
  `
}
