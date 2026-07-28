import {PageBase} from "~/base/page"
import {StartPage} from "~/pages/start"

export class StartTestVideoPage extends PageBase {
  static data = this.buildData()
  async handleCallbackQueryData() {
    await this.bdefault.show()
  }

  bdefault = {
    show: async () => {
      const kb = this.inlineKeyboardT([StartPage.data.callbackQueryData(`3`)])
      await this.renderEditVideo(kb)
    }
  }

  static template = `
    <g-base>
      ${this.kbk.back()}
      <g-media type="video" src="https://www.w3schools.com/html/mov_bbb.mp4">
        🎥 Video demo
        
        This is a sample video reply with a caption.
      </g-media>
      <g-media lang="id" type="video" src="https://www.w3schools.com/html/mov_bbb.mp4">
        🎥 Demo video
        
        Ini adalah contoh balasan video dengan caption.
      </g-media>
    </g-base>
  `
}
