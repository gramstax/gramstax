import {PageBase} from "~/base/page"
import {StartPage} from "./start"

export class TestAudioPage extends PageBase {
  async handleCallbackData() {
    await this.bdefault.show()
  }

  bdefault = {
    show: async () => {
      const kb = this.inlineKeyboardT([StartPage.data.callbackData(`3`)])
      await this.editAudio(kb)
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
