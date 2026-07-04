import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Main {
  static async showIndex(ctx: TestLocationPage) {
    const kb = ctx.inlineKeyboardT([StartPage.data.callbackData(`3`)])
    const da = {}
    await ctx.editLocation(kb, da)
  }
}

export class TestLocationPage extends PageBase {
  async handleCallbackData() {
    await Main.showIndex(this)
  }

  static template = `
    <g-base>
      ${this.kbk.back()}
      <g-media type="location" latitude="51.50735" longitude="-0.12776">
        📍 Location demo
        
        This shows a location reply with coordinates.
      </g-media>
      <g-media lang="id" type="location" latitude="-7.257471" longitude="112.752088">
        📍 Demo lokasi
        
        Ini menampilkan balasan lokasi dengan koordinat.
      </g-media>
    </g-base>
  `
}
