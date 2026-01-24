import {PageBase} from "~/base/page"
import {StartPage} from "./start"

export class TestVoicePage extends PageBase {
  async callback() {
    const kb = this.inlineKeyboardT([StartPage.data.callback(`3`)])
    await this.editVoice(kb)
  }

  static template = `
    <base>
      ${this.kbk.back()}
      <media type="voice" src="https://www.w3schools.com/html/horse.ogg">
        🎙️ Voice demo
        
        This is a voice reply without a caption attachment.
      </media>
      <media lang="id" type="voice" src="https://www.w3schools.com/html/horse.ogg">
        🎙️ Demo voice
        
        Ini adalah balasan voice tanpa lampiran caption.
      </media>
    </base>
  `
}
