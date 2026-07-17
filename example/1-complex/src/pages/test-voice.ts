import {PageBase} from "~/base/page"
import {StartPage} from "./start"

export class TestVoicePage extends PageBase {
  async handleCallbackData() {
    await this.bdefault.show()
  }

  bdefault = {
    show: async () => {
      const kb = this.inlineKeyboardT([StartPage.data.callbackData(`3`)])
      await this.editVoice(kb)
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
