import {PageBase} from "~/base/page"
import {StartPage} from "./start"

// Help page describing navigation rules.
export class HelpPage extends PageBase {
  static data = this.buildData({intentText: `Help`})

  kb() {
    return this.ikb((k, a) => k.text(a[0]!, StartPage.data.callback()))
  }

  async to(isEdit = true) {
    const kb = this.kb()
    const id = `help`
    if (isEdit) {
      await this.edit(kb, {}, id)
    } else {
      await this.reply(kb, {}, id)
    }
  }

  async callback() {
    await this.to(true)
  }

  async text() {
    await this.to(false)
  }

  static template = `
    <base>
      ${this.kbp.back()}
      <message>
        Help & Navigation

        - Use inline buttons to drill into menus.
        - Use the bottom keyboard for quick actions.
        - Pagination buttons appear when lists are long.
      </message>
    </base>

    <base id="help">
      <message>
        Need a refresher? Choose Menu to start again.
      </message>
    </base>
  `
}
