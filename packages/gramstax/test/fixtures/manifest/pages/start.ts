import {Ctx} from "~/core/ctx"

export class MStartPage extends Ctx {
  static data = this.buildData({name: `start`})

  async handleCommandText() {
    await this.renderAuto(null, {})
  }

  helper = {}

  static template = `
    <g-base>
      <g-message>START</g-message>
    </g-base>
  `
}
