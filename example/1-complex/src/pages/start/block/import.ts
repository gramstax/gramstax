import {PageBase} from "~/base/page"
import {StartPage} from "~/pages/start"

export class StartBlockImportPage extends PageBase {
  static data = this.buildData()

  async handleCallbackQueryData() {
    await this.gdefault.show()
  }

  helper = {}
  gdefault = {
    show: async () => {
      await this.renderText({keyboard: this.inlineKeyboardT([this, StartPage], `1`), data: {number: Math.random()}})
    },
    process: () => {}
  }

  static template = `
    <g-base>
      <g-import src="start" base="for-block-import" />
    </g-base>
  `
}
