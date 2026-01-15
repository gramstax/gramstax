import {PageBase} from "~/base/page"
import {StartPage} from "./start"

export class TestLocationPage extends PageBase {
  kb() {
    return this.ikb((k, a) => {
      return k.text(a[0]!, StartPage.data.callback(`3`))
    })
  }

  async callback() {
    await this.editLocation(this.kb())
  }

  static template = `
    <base>
      ${this.kbp.back()}
      <media type="location" latitude="51.50735" longitude="-0.12776"></media>
      <media lang="id" type="location" latitude="-7.257471" longitude="112.752088"></media>
    </base>
  `
}
