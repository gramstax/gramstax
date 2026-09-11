import {PageBase} from "~/base/page"
import {StartPage} from "~/pages/start"

export class StartTestPhotoPage extends PageBase {
  static data = this.buildData()

  async handleCallbackQueryData() {
    await this.gdefault.show()
  }

  helper = {}
  gdefault = {
    show: async () => {
      const kb = this.inlineKeyboardT([StartPage.data.callbackQueryData(`3`)])
      await this.renderEditPhoto(kb)
    },
    process: () => {}
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
