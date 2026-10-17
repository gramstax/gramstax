import {PageBase} from "~/base/page"
import {StartPage} from "~/pages/start"

export class StartTestVoicePage extends PageBase {
  static data = this.buildData()

  async handleCallbackQueryData() {
    await this.gdefault.show()
  }

  helper = {}
  gdefault = {
    show: async () => {
      await this.renderVoice({keyboard: this.inlineKeyboardT([StartPage.data.callbackQueryData(`3`)]), mode: "edit"})
    },
    process: () => {}
  }

  static template = `
    <g-base>
      ${this.kbk.back()}
      <g-media type="voice" src="https://www.w3schools.com/html/horse.ogg"></g-media>
      <g-media lang="id" type="voice" src="https://www.w3schools.com/html/horse.ogg"></g-media>
    </g-base>
  `
}
