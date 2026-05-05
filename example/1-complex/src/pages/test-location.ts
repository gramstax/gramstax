import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Base {
  static step1 = `s1`
}

class Main {
  static async showStep1Form(ctx: TestLocationPage) {
    const bi = Base.step1
    const kb = ctx.inlineKeyboardT([StartPage.data.callbackData(`3`)], `1`, bi)
    const da = {}
    await ctx.editLocation(kb, da, bi)
  }

  static async processStep1Answer(ctx: TestLocationPage) {
    throw ctx
  }
}

export class TestLocationPage extends PageBase {
  async handleCallbackData() {
    await Main.showStep1Form(this)
  }

  static template = `
    <base id="${Base.step1}">
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
