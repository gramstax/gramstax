import {PageBase} from "~/base/page"
import {StartPage} from "./start"

export class TestAudioPage extends PageBase {
  async callback() {
    const kb = this.inlineKeyboardT([StartPage.data.callback(`3`)])
    await this.editAudio(kb)
  }

  static template = `
    <base>
      ${this.kbk.back()}
      <media type="audio" src="https://www.w3schools.com/html/horse.ogg">Caption text for media <b>audio</b></media>
      <media lang="id" type="audio" src="https://www.w3schools.com/html/horse.ogg">Kaption text untuk media <b>suara</b></media>
    </base>
  `
}
