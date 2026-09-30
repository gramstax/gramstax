import {Ctx} from "~/core/ctx"

export class MUsersPage extends Ctx {
  static data = this.buildData({name: `admin/users`})

  async handleCommandText() {
    await this.renderAuto(null, {})
  }

  helper = {}

  static template = `
    <g-base>
      <g-message>USERS</g-message>
    </g-base>
  `
}
