import {PageBase} from "~/base/page"
import {StartPage} from "./start"

export class TestVoicePage extends PageBase {
  kb() {
    return this.ikb((k, a) => {
      return k.text(a[0]!, StartPage.data.callbackData(`3`))
    })
  }

  async callback() {
    await this.editVoice(this.kb())
  }

  static template = /*jsx*/ `
    <base>
      ${this.kbc.back()}
      <media type="voice" src="https://www.w3schools.com/html/horse.ogg"></media>
      <media lang="id" type="voice" src="https://www.w3schools.com/html/horse.ogg"></media>
    </base>
  `
}
