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
      const kb = this.inlineKeyboardT([this, StartPage], `1`)
      const da = {number: Math.random()}
      await this.renderAuto(kb, da)
    },
    process: () => {}
  }

  static template = `
    <g-base>
      <g-import src="start" base="for-block-import" />
    </g-base>
  `
}
