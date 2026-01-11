import {PageBase} from "~/base/page"
import {StartPage} from "./start"

export class TestLocationPage extends PageBase {
  kb() {
    return this.inlineKeyboard((kb, arr) => {
      return kb.text(arr[0]!, StartPage.data.callbackData(`3`))
    })
  }

  async callback() {
    await this.editLocation(this.kb())
  }

  static template = /*jsx*/ `
    <base>
      ${this.kbc.back()}
      <media type="location" latitude="51.50735" longitude="-0.12776"></media>
      <media lang="id" type="location" latitude="-7.257471" longitude="112.752088"></media>
    </base>
  `
}
