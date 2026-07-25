import {PageBase} from "~/base/page"
import {StartPage} from "~/pages/start"

export class TestVideoNotePage extends PageBase {
  async handleCallbackQueryData() {
    await this.bdefault.show()
  }

  bdefault = {
    show: async () => {
      const kb = this.inlineKeyboardT([StartPage.data.callbackQueryData(`3`)])
      await this.renderEditVideoNote(kb)
    }
  }

  static template = `
    <g-base>
      ${this.kbk.back()}
      <g-media type="video_note" src="https://www.w3schools.com/html/mov_bbb.mp4">
        🎬 Video note demo
        
        This is a short video note reply.
      </g-media>
      <g-media lang="id" type="video_note" src="https://www.w3schools.com/html/mov_bbb.mp4">
        🎬 Demo video note
        
        Ini adalah balasan video note singkat.
      </g-media>
    </g-base>
  `
}
