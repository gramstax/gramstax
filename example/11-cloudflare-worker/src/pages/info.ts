import {PageBase} from "~/base/page"

export class InfoPage extends PageBase {
  static data = this.buildData({name: `info`})

  async handleCommandText() {
    await this.renderAuto(null, {})
  }

  helper = {}
}
