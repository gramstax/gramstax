import {KeyboardComponent} from "~/components/keyboard"
import {PageBase} from "~/base/page"
import {StartPage} from "./start"

export class TestVideoPage extends PageBase {
  kb() {
    return this.inlineKeyboard((kb, arr) => {
      return kb.text(arr[0]!, StartPage.data.callbackData(`3`))
    })
  }

  async callback() {
    await this.editVideo(this.kb())
  }

  static template = /*jsx*/ `
    <base>
      ${KeyboardComponent.back()}
      <media type="video" src="https://www.w3schools.com/html/mov_bbb.mp4">Caption text for media <b>video</b></media>
      <media lang="id" type="video" src="https://www.w3schools.com/html/mov_bbb.mp4">Kaption text untuk media <b>video</b></media>
    </base>
  `
}
