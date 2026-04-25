import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Perform {
  static async entryPoint(ctx: TestLocationPage) {
    const kb = ctx.inlineKeyboardT([StartPage.data.callbackData(`3`)])
    await ctx.editLocation(kb)
  }
}

export class TestLocationPage extends PageBase {
  async handleCallbackData() {
    await Perform.entryPoint(this)
  }

  static template = `
    <base>
      ${this.kbk.back()}
      <media type="location" latitude="51.50735" longitude="-0.12776">
        📍 Location demo
        
        This shows a location reply with coordinates.
      </media>
      <media lang="id" type="location" latitude="-7.257471" longitude="112.752088">
        📍 Demo lokasi
        
        Ini menampilkan balasan lokasi dengan koordinat.
      </media>
    </base>
  `
}
