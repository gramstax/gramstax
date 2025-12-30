import { KeyboardComponent } from "~/components/keyboard"
import { PageBase } from "~/base/page"
import { StartPage } from "./start"

export class TestPhotoPage extends PageBase {
  public kb() {
    return this.inlineKeyboard((kb, arr) => {
      return kb.text(arr[0]!, StartPage.data.callbackData(`3`))
    })
  }

  public async callback() {
    await this.editPhoto(this.kb())
  }

  public static template = /*jsx*/ `
    <base>
      ${KeyboardComponent.back()}
      <media type="photo" src="https://www.w3schools.com/html/img_girl.jpg">Caption text for media <b>photo</b></media>
      <media lang="id" type="photo" src="https://www.w3schools.com/html/img_girl.jpg">Kaption text untuk media <b>foto</b></media>
    </base>
  `
}
