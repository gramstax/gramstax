import {Ctx} from "~/core/ctx"

export class MCardPage extends Ctx {
  static data = this.buildData({name: `card`})

  async handleCommandText() {
    await this.renderText({data: {}})
  }

  helper = {}
}
