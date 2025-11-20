import { CtxCore } from "../core/ctx"
import { StartPage } from "./start"

export class TestLocationPage extends CtxCore {
  public kb() {
    return this.buildInlineKeyboard((kb, arr) => {
      return kb.text(arr[0], StartPage.data.callbackData(`3`))
    })
  }

  public async callback() {
    const kb = this.kb()
    await this.editLocation(kb)
  }

  public static template = `
    <base>
      <keyboard lang="en" type="inline">Back</keyboard>
      <keyboard lang="id" type="inline">Kembali</keyboard>

      <media lang="en" type="location" latitude="51.50735" longitude="-0.12776"></media>
      <media lang="id" type="location" latitude="-7.257471" longitude="112.752088"></media>
    </base>
  `
}
