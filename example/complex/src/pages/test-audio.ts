import {PageBase} from "~/base/page"
import {StartPage} from "./start"

export class TestAudioPage extends PageBase {
  kb() {
    return this.ikb((k, a) => {
      return k.text(a[0]!, StartPage.data.callbackData(`3`))
    })
  }

  async callback() {
    await this.editAudio(this.kb())
  }

  static template = `
    <base>
      ${this.kbc.back()}
      <media type="audio" src="https://www.w3schools.com/html/horse.ogg">Caption text for media <b>audio</b></media>
      <media lang="id" type="audio" src="https://www.w3schools.com/html/horse.ogg">Kaption text untuk media <b>suara</b></media>
    </base>
  `
}
