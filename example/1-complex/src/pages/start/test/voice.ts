import {PageBase} from "~/base/page"
import {StartPage} from "~/pages/start"

export class StartTestVoicePage extends PageBase {
  static data = this.buildData()
  async handleCallbackQueryData() {
    await this.bdefault.show()
  }

  bdefault = {
    show: async () => {
      const kb = this.inlineKeyboardT([StartPage.data.callbackQueryData(`3`)])
      await this.renderEditVoice(kb)
    }
  }

  static template = `
    <g-base>
      ${this.kbk.back()}
      <g-media type="voice" src="https://www.w3schools.com/html/horse.ogg">
        🎙️ Voice demo
        
        This is a voice reply without a caption attachment.
      </g-media>
      <g-media lang="id" type="voice" src="https://www.w3schools.com/html/horse.ogg">
        🎙️ Demo voice
        
        Ini adalah balasan voice tanpa lampiran caption.
      </g-media>
    </g-base>
  `
}
