import {PageBase} from "~/base/page"
import {StartPage} from "~/pages/start"

export class StartTestLocationPage extends PageBase {
  static data = this.buildData()

  async handleCallbackQueryData() {
    await this.bdefault.show()
  }

  bdefault = {
    show: async () => {
      const kb = this.inlineKeyboardT([StartPage.data.callbackQueryData(`3`)])
      await this.renderEditLocation(kb)
    }
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
