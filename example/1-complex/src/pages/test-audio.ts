import {PageBase} from "~/base/page"
import {StartPage} from "./start"

export class TestAudioPage extends PageBase {
  async handleCallbackData() {
    const kb = this.inlineKeyboardT([StartPage.data.callbackdata(`3`)])
    await this.editAudio(kb)
  }

  static template = `
    <base>
      ${this.kbk.back()}
      <media type="audio" src="https://www.w3schools.com/html/horse.ogg">
        🎧 Audio demo
        
        This is a sample audio reply with a caption.
      </media>
      <media lang="id" type="audio" src="https://www.w3schools.com/html/horse.ogg">
        🎧 Demo audio
        
        Ini adalah contoh balasan audio dengan caption.
      </media>
    </base>
  `
}
