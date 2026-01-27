import {PageBase} from "~/base/page"
import {StartPage} from "./start"

// Help page describing navigation rules.
export class HelpPage extends PageBase {
  static data = this.buildData({intentText: `Help`})

  async show(edit = true) {
    const kb = this.inlineKeyboardT([StartPage])
    const bi = `help`
    if (edit) await this.edit(kb, {}, bi)
    else await this.reply(kb, {}, bi)
  }

  async handleCallbackData() {
    await this.show(true)
  }

  async handleText() {
    await this.show(false)
  }

  static template = `
    <base>
      ${this.kbk.back()}
      <message>
        ❓ Help & Navigation

        Use inline buttons to explore menus, and the bottom keyboard for quick actions.
        Pagination buttons appear when lists are long.
      </message>
    </base>

    <base id="help">
      <message>
        ✅ Quick tip

        Need a refresher? Choose Menu to start again.
      </message>
    </base>
  `
}
