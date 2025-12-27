import { KeyboardComponent } from "~/components/keyboard"
import { PageBase } from "~/base/page"
import { StartPage } from "./start"

export class TestVoicePage extends PageBase {
  public kb() {
    return this.inlineKeyboard((kb, arr) => {
      return kb.text(arr[0]!, StartPage.data.callbackData(`3`))
    })
  }

  public async callback() {
    await this.editVoice(this.kb())
  }

  public static template = /*jsx*/ `
    <base>
      ${KeyboardComponent.back()}
      <media type="voice" src="https://www.w3schools.com/html/horse.ogg"></media>
      <media lang="id" type="voice" src="https://www.w3schools.com/html/horse.ogg"></media>
    </base>
  `
}
