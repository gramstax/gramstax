import {PageBase} from "~/base/page"
import {StartPage} from "~/pages/start"

export class TestAudioPage extends PageBase {
  async handleCallbackQueryData() {
    await this.bdefault.show()
  }

  bdefault = {
    show: async () => {
      const kb = this.inlineKeyboardT([StartPage.data.callbackQueryData(`3`)])
      await this.renderEditAudio(kb)
    }
  }

  static template = `
    <g-base>
      ${this.kbk.back()}
      <g-media type="audio" src="https://www.w3schools.com/html/horse.ogg">
        🎧 Audio demo
        
        This is a sample audio reply with a caption.
      </g-media>
      <g-media lang="id" type="audio" src="https://www.w3schools.com/html/horse.ogg">
        🎧 Demo audio
        
        Ini adalah contoh balasan audio dengan caption.
      </g-media>
    </g-base>
  `
}
